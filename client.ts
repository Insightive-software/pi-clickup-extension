import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export const SPEC_URLS = {
  v2: "https://developer.clickup.com/openapi/clickup-api-v2-reference.json",
  v3: "https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml",
} as const;

export type ApiVersion = keyof typeof SPEC_URLS;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type QueryValue = string | number | boolean | null | Array<string | number | boolean>;
export type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface UploadFile {
  path: string;
  field?: string;
  content_type?: string;
}

export interface ApiRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  files?: UploadFile[];
  cwd?: string;
  timeout_ms?: number;
}

export interface ApiResult {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export interface RequestOptions {
  token?: string;
  signal?: AbortSignal;
  fetchImpl?: Fetcher;
  sleepImpl?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface OpenApiOperation {
  version: ApiVersion;
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: unknown[];
  requestBody?: unknown;
  responseCodes: string[];
  raw: Record<string, unknown>;
  spec: Record<string, unknown>;
}

export class ClickUpApiError extends Error {
  readonly status: number;
  readonly response: string;

  constructor(status: number, message: string, response: string) {
    super(message);
    this.name = "ClickUpApiError";
    this.status = status;
    this.response = response;
  }
}

export async function getToken(): Promise<string> {
  const token = process.env.CLICKUP_API_TOKEN ?? process.env.CLICKUP_TOKEN ?? process.env.CLICKUP_API_KEY;
  if (token?.trim()) return token.trim();

  try {
    const saved = (await readFile(resolve(homedir(), ".config/cu/token"), "utf8")).trim();
    if (saved) return saved;
  } catch {
    // The setup error below is clearer than a filesystem error.
  }

  throw new Error("ClickUp token not configured. Run `cu token` locally or set CLICKUP_API_TOKEN.");
}

export function normalizeApiPath(input: string): string {
  let path = input.trim();
  if (/^https?:\/\//i.test(path)) throw new Error("Use a ClickUp API path, not a full URL.");
  if (path.includes("?") || path.includes("#")) throw new Error("Put query parameters in the query object.");
  if (!path.startsWith("/")) path = `/${path}`;
  if (/^\/v[23](\/|$)/.test(path)) path = `/api${path}`;
  if (!/^\/api\/v[23](\/|$)/.test(path)) throw new Error("Path must begin with /api/v2/ or /api/v3/.");
  return path;
}

export function buildUrl(path: string, query: Record<string, QueryValue> = {}): URL {
  const url = new URL(normalizeApiPath(path), "https://api.clickup.com");
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) url.searchParams.append(key, item === null ? "" : String(item));
  }
  return url;
}

export async function requestClickUp(input: ApiRequest, options: RequestOptions = {}): Promise<ApiResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? sleep;
  const token = options.token ?? await getToken();
  const url = buildUrl(input.path, input.query);
  const attempts = 3;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const headers = new Headers({ Accept: "application/json", Authorization: token });
    const body = await makeBody(input, headers);
    const timeout = AbortSignal.timeout(input.timeout_ms ?? 30_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetchImpl(url, { method: input.method, headers, body, signal });
    const text = await response.text();

    if (attempt < attempts - 1 && response.status === 429) {
      await sleepImpl(rateLimitDelay(response.headers, attempt), options.signal);
      continue;
    }

    if (attempt < attempts - 1 && input.method === "GET" && [502, 503, 504].includes(response.status)) {
      await sleepImpl(500 * 2 ** attempt, options.signal);
      continue;
    }

    if (!response.ok) {
      const excerpt = text.length > 8_000 ? `${text.slice(0, 8_000)}…` : text;
      throw new ClickUpApiError(response.status, `ClickUp API ${response.status} ${response.statusText}`, excerpt);
    }

    return {
      status: response.status,
      data: parseResponse(text, response.headers.get("content-type")),
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  throw new Error("ClickUp request failed after retries.");
}

async function makeBody(input: ApiRequest, headers: Headers): Promise<BodyInit | undefined> {
  if (input.files?.length) {
    const form = new FormData();
    appendFormValues(form, input.body);
    for (const [index, file] of input.files.entries()) {
      const path = resolve(input.cwd ?? process.cwd(), file.path.replace(/^@/, ""));
      form.append(
        file.field ?? `attachment[${index}]`,
        new Blob([await readFile(path)], file.content_type ? { type: file.content_type } : undefined),
        basename(path),
      );
    }
    return form;
  }

  if (input.body === undefined) return undefined;
  headers.set("Content-Type", "application/json");
  return JSON.stringify(input.body);
}

function appendFormValues(form: FormData, body: unknown): void {
  if (body === undefined || body === null) return;
  if (typeof body !== "object" || Array.isArray(body)) throw new Error("Multipart body must be an object.");
  for (const [key, value] of Object.entries(body)) {
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

function parseResponse(text: string, contentType: string | null): unknown {
  if (!text) return null;
  if (contentType?.includes("json")) return JSON.parse(text);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function rateLimitDelay(headers: Headers, attempt: number): number {
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return Math.min(60_000, Math.max(100, reset * 1_000 - Date.now() + 100));
  const retryAfter = Number(headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(60_000, retryAfter * 1_000);
  return 1_000 * 2 ** attempt;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolvePromise, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

export async function loadOpenApiSpecs(fetchImpl: Fetcher = fetch): Promise<Record<ApiVersion, Record<string, unknown>>> {
  const [v2Response, v3Response] = await Promise.all([fetchImpl(SPEC_URLS.v2), fetchImpl(SPEC_URLS.v3)]);
  if (!v2Response.ok) throw new Error(`Could not load ClickUp v2 specification (${v2Response.status}).`);
  if (!v3Response.ok) throw new Error(`Could not load ClickUp v3 specification (${v3Response.status}).`);
  return {
    v2: await v2Response.json() as Record<string, unknown>,
    v3: parseYaml(await v3Response.text()) as Record<string, unknown>,
  };
}

export function extractOperations(specs: Record<ApiVersion, Record<string, unknown>>): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];
  for (const version of ["v2", "v3"] as const) {
    const spec = specs[version];
    const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;
    for (const [path, pathItem] of Object.entries(paths)) {
      for (const method of ["get", "post", "put", "patch", "delete"] as const) {
        const raw = pathItem[method] as Record<string, unknown> | undefined;
        if (!raw) continue;
        operations.push({
          version,
          id: String(raw.operationId ?? `${method}-${path}`),
          method: method.toUpperCase() as HttpMethod,
          path,
          summary: String(raw.summary ?? ""),
          description: String(raw.description ?? ""),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          parameters: [...((pathItem.parameters as unknown[] | undefined) ?? []), ...((raw.parameters as unknown[] | undefined) ?? [])],
          requestBody: raw.requestBody,
          responseCodes: Object.keys((raw.responses as Record<string, unknown> | undefined) ?? {}),
          raw,
          spec,
        });
      }
    }
  }
  return operations;
}

export function searchOperations(operations: OpenApiOperation[], query: string, version: ApiVersion | "all" = "all"): OpenApiOperation[] {
  const needle = query.trim().toLowerCase();
  return operations
    .filter(operation => version === "all" || operation.version === version)
    .map(operation => ({ operation, score: operationScore(operation, needle) }))
    .filter(match => !needle || match.score > 0)
    .sort((a, b) => b.score - a.score || a.operation.id.localeCompare(b.operation.id))
    .map(match => match.operation);
}

export function operationDetail(operation: OpenApiOperation): Record<string, unknown> {
  return {
    version: operation.version,
    operation_id: operation.id,
    method: operation.method,
    path: operation.path,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags,
    parameters: resolveLocalRefs(operation.parameters, operation.spec),
    request_body: resolveLocalRefs(operation.requestBody, operation.spec),
    response_codes: operation.responseCodes,
  };
}

function operationScore(operation: OpenApiOperation, needle: string): number {
  if (!needle) return 1;
  const id = operation.id.toLowerCase();
  const path = operation.path.toLowerCase();
  if (id === needle) return 1_000;
  if (path === needle) return 900;
  let score = id.includes(needle) ? 100 : 0;
  if (path.includes(needle)) score += 80;
  if (operation.summary.toLowerCase().includes(needle)) score += 60;
  if (operation.tags.some(tag => tag.toLowerCase().includes(needle))) score += 40;
  if (operation.description.toLowerCase().includes(needle)) score += 10;
  return score;
}

function resolveLocalRefs(value: unknown, spec: Record<string, unknown>, depth = 0, seen = new Set<string>()): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(item => resolveLocalRefs(item, spec, depth + 1, new Set(seen)));

  const object = value as Record<string, unknown>;
  if (typeof object.$ref === "string" && object.$ref.startsWith("#/")) {
    if (seen.has(object.$ref)) return { $ref: object.$ref, circular: true };
    const target = object.$ref.slice(2).split("/").reduce<unknown>((current, key) =>
      current && typeof current === "object" ? (current as Record<string, unknown>)[key.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined,
    spec);
    if (target === undefined) return object;
    const nextSeen = new Set(seen).add(object.$ref);
    return resolveLocalRefs(target, spec, depth + 1, nextSeen);
  }

  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, resolveLocalRefs(item, spec, depth + 1, new Set(seen))]));
}
