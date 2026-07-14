# Pi ClickUp Extension

Global [Pi](https://pi.dev) tools for direct, full-control access to ClickUp's Public API without depending on MCP.

The extension reads ClickUp's official OpenAPI specifications at runtime. It currently exposes all **172 documented operations** across API v2 and v3 through two tools instead of maintaining a large, fragile set of endpoint wrappers.

## Tools

### `clickup_docs`

Searches the official ClickUp v2 and v3 OpenAPI specifications by operation ID, path, category, or phrase. Exact matches return parameters and the resolved request-body schema.

### `clickup_api`

Calls any authenticated ClickUp API v2 or v3 endpoint with:

- GET, POST, PUT, PATCH, and DELETE
- Query parameters and arrays
- Arbitrary JSON request bodies
- Multipart file attachments
- 429 rate-limit handling
- Safe GET retries for transient 502/503/504 responses
- Cancellation and per-attempt timeouts
- 50 KB / 2,000-line output truncation

DELETE requests and local-file uploads require interactive confirmation.

## Requirements

- Node.js 22.19 or newer
- Pi 0.80.6 or newer
- A ClickUp personal API token

## Install

```bash
pi install git:github.com/umar-rana/pi-clickup-extension
```

Restart Pi or run `/reload` after installation.

For local development:

```bash
git clone https://github.com/umar-rana/pi-clickup-extension.git
cd pi-clickup-extension
npm install
pi -e ./index.ts
```

## Configure authentication securely

Generate a personal API token in ClickUp: **Avatar → Settings → Apps → API Token → Generate**. Personal use does not require ClickUp's OAuth access-token endpoint.

Never paste a ClickUp token into Pi, source code, issues, logs, screenshots, or commits. The extension does not include a token; every user supplies their own locally.

### macOS

Copy the token from ClickUp, then run:

```zsh
mkdir -p ~/.config/cu
pbpaste > ~/.config/cu/token
chmod 600 ~/.config/cu/token
: | pbcopy
```

The last command clears the clipboard. Verify owner-only permissions:

```zsh
ls -l ~/.config/cu/token
```

The permissions should begin with `-rw-------`.

### Linux with Bash

```bash
mkdir -p "$HOME/.config/cu"
read -r -s -p "ClickUp personal token: " clickup_token; echo
printf '%s' "$clickup_token" > "$HOME/.config/cu/token"
unset clickup_token
chmod 600 "$HOME/.config/cu/token"
```

### Token lookup order

1. `CLICKUP_API_TOKEN`
2. `CLICKUP_TOKEN`
3. `~/.config/cu/token`
4. Legacy fallback: `CLICKUP_API_KEY`

Environment variables are useful when supplied by a trusted secret manager. Do not commit them in `.env` files.

The token is sent only in the `Authorization` header to paths that resolve beneath:

- `https://api.clickup.com/api/v2/`
- `https://api.clickup.com/api/v3/`

## Usage

Ask Pi naturally:

```text
List my ClickUp workspaces.
Find the API operation for creating a task, then create it in list 123.
Show open tasks assigned to me across the workspace.
Attach ./report.pdf to task abc123.
Update this task's custom field.
Create a ClickUp Doc page from this Markdown.
```

Pi should use `clickup_docs` when it does not know an endpoint's current request shape, then call `clickup_api`.

## API coverage

Coverage follows ClickUp's official specifications, including:

- Workspaces, Spaces, Folders, Lists, Tasks, subtasks, templates, and task relationships
- Comments, checklists, tags, custom fields, custom task types, members, guests, users, and groups
- Goals, views, time tracking, webhooks, attachments, and audit logs
- API v3 Docs, Chat, privacy/access controls, task moves, and per-user estimates

Availability still depends on the ClickUp Workspace plan and the authenticated user's permissions. ClickUp v3 Chat endpoints are experimental.

## Security model

- Fixed ClickUp API host and post-normalization v2/v3 path confinement
- Rejection of URL, query-string, fragment, and encoded traversal input in API paths
- No token logging or inclusion in tool output
- Interactive confirmation for DELETE and file uploads
- Mutating 5xx requests are not retried, preventing accidental duplicate writes
- ClickUp content is treated as untrusted data, not agent instructions
- Oversized responses are written to private temporary files with mode `0600`

This extension has full access to the ClickUp resources permitted by its token. Review requested mutations before approving them.

## Development

```bash
npm run verify
```

This runs strict TypeScript checking and the Node test suite.

Branch flow:

```text
development → staging → production
```

Authors do not merge their own changes. A separate reviewer approves and merges into `staging`; tested releases are then promoted to `production`.

## Documentation sources

- [ClickUp authentication](https://developer.clickup.com/docs/authentication)
- [ClickUp API reference](https://developer.clickup.com/reference)
- [ClickUp OpenAPI specifications](https://developer.clickup.com/docs/open-api-spec)
- [ClickUp rate limits](https://developer.clickup.com/docs/rate-limits)
