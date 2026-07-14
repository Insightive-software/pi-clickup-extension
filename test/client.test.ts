import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ClickUpApiError,
  buildUrl,
  extractOperations,
  getToken,
  normalizeApiPath,
  operationDetail,
  requestClickUp,
  searchOperations,
  type Fetcher,
} from "../client.ts";

test("normalizes only ClickUp v2/v3 API paths and serializes arrays", async () => {
  assert.equal(normalizeApiPath("v2/team"), "/api/v2/team");
  assert.equal(normalizeApiPath("/api/v3/workspaces/1/docs"), "/api/v3/workspaces/1/docs");
  assert.throws(() => normalizeApiPath("https://evil.test/api/v2/team"));
  assert.throws(() => normalizeApiPath("/api/v4/team"));
  assert.throws(() => buildUrl("/api/v2/../../secret"));
  assert.throws(() => buildUrl("/api/v2/%2e%2e/%2e%2e/secret"));
  assert.throws(() => buildUrl("/api/v2/foo%2f..%2f..%2fsecret"));
  assert.throws(() => buildUrl("/api/v2\\..\\..\\secret"));
  assert.equal(buildUrl("/v2/team/1/task", { "statuses[]": ["open", "done"], archived: false }).toString(),
    "https://api.clickup.com/api/v2/team/1/task?statuses%5B%5D=open&statuses%5B%5D=done&archived=false");

  let fetched = false;
  await assert.rejects(requestClickUp({ method: "GET", path: "/api/v2/../../secret" }, {
    token: "secret",
    fetchImpl: async () => {
      fetched = true;
      return new Response("{}");
    },
  }));
  assert.equal(fetched, false);
});

test("prefers the owner-only token file over the legacy API key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-clickup-token-test-"));
  const path = join(directory, "token");
  await writeFile(path, "file-token\n", { mode: 0o600 });
  const previous = process.env.CLICKUP_API_KEY;
  process.env.CLICKUP_API_KEY = "stale-legacy-token";
  try {
    assert.equal(await getToken(path), "file-token");
  } finally {
    if (previous === undefined) delete process.env.CLICKUP_API_KEY;
    else process.env.CLICKUP_API_KEY = previous;
  }
});

test("sends authenticated JSON and parses responses", async () => {
  let request: RequestInit | undefined;
  const fetchImpl: Fetcher = async (_url, init) => {
    request = init;
    return new Response('{"id":"task-1"}', { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await requestClickUp({ method: "POST", path: "/v2/list/1/task", body: { name: "Test" } }, { token: "secret", fetchImpl });
  const headers = new Headers(request?.headers);
  assert.equal(headers.get("authorization"), "secret");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(request?.body, '{"name":"Test"}');
  assert.deepEqual(result.data, { id: "task-1" });
});

test("retries rate limits but does not retry a mutating 503", async () => {
  let calls = 0;
  const delays: number[] = [];
  const fetchImpl: Fetcher = async () => {
    calls++;
    return calls === 1
      ? new Response("limited", { status: 429, headers: { "retry-after": "0" } })
      : new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await requestClickUp({ method: "GET", path: "/v2/team" }, {
    token: "secret",
    fetchImpl,
    sleepImpl: async ms => { delays.push(ms); },
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [0]);

  const unavailable: Fetcher = async () => new Response("down", { status: 503, statusText: "Unavailable" });
  await assert.rejects(
    requestClickUp({ method: "POST", path: "/v2/list/1/task", body: {} }, { token: "secret", fetchImpl: unavailable }),
    (error: unknown) => error instanceof ClickUpApiError && error.status === 503,
  );
});

test("builds ClickUp multipart uploads", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-clickup-test-"));
  await writeFile(join(directory, "note.txt"), "hello");
  let form: FormData | undefined;
  const fetchImpl: Fetcher = async (_url, init) => {
    form = init?.body as FormData;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await requestClickUp({
    method: "POST",
    path: "/v2/task/1/attachment",
    cwd: directory,
    body: { custom_task_ids: true },
    files: [{ path: "note.txt" }],
  }, { token: "secret", fetchImpl });
  assert.equal(form?.get("custom_task_ids"), "true");
  assert.equal((form?.get("attachment[0]") as File).name, "note.txt");
});

test("searches both specifications and resolves request schema references", () => {
  const specs = {
    v2: {
      paths: {
        "/v2/task/{task_id}": {
          put: {
            operationId: "UpdateTask",
            summary: "Update Task",
            tags: ["Tasks"],
            requestBody: { $ref: "#/components/requestBodies/Update" },
            responses: { "200": {} },
          },
        },
      },
      components: { requestBodies: { Update: { content: { "application/json": { schema: { type: "object" } } } } } },
    },
    v3: {
      paths: {
        "/api/v3/workspaces/{workspace_id}/docs": {
          get: { operationId: "searchDocsPublic", summary: "Search Docs", tags: ["Docs"], responses: { "200": {} } },
        },
      },
    },
  };
  const operations = extractOperations(specs);
  assert.equal(operations.length, 2);
  assert.equal(searchOperations(operations, "docs")[0].id, "searchDocsPublic");
  assert.deepEqual(operationDetail(searchOperations(operations, "UpdateTask")[0]).request_body,
    { content: { "application/json": { schema: { type: "object" } } } });
});
