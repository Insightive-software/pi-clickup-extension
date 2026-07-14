# PROJECT STATUS — Pi ClickUp

## Goal and current phase

Build a global Pi extension that replaces unstable ClickUp MCP/API tooling with direct, complete ClickUp Public API v2/v3 control. Current phase: production promotion. Core implementation, public-repository onboarding, staging QA, global installation, and the authenticated read-only ClickUp smoke test are complete. Done means Opus QA promotes staging to production and the public repository uses `production` as its default branch.

## Source of truth

| Area | Source |
|---|---|
| Code, specs, checks | `https://github.com/Insightive-software/pi-clickup-extension` and this local checkout |
| API contract | Official ClickUp v2/v3 OpenAPI specifications |
| Coordination | `PROJECT_STATUS.md` |
| Published project notes | Obsidian `03 Projects/PiClickUp/` |
| Tickets | ClickUp after activation |
| Global runtime | Pi user package `/Users/umar/Develop/PiCode/pi-clickup`; token file `~/.config/cu/token` |

## Team

| Pi | Model | Scope | Session ID |
|---|---|---|---|
| Dev/orchestrator | GPT-5.6 | implementation, sequencing, human interface | current session |
| QA reviewer-of-record | Claude Opus 4.8 | security/correctness review and staging merge | `pi-clickup-qa` |
| Docs/Ops | Current session | Obsidian, activation and smoke verification | current session |

## Merge authority

The author never merges. Opus 4.8 QA is the sole reviewer-of-record and may merge `development` into `staging`, then promote `staging` into `production`, after checks and activation gates pass. If rate-limited, report and pause; no ungated fallback merge.

## Branch and verification rules

`development → staging → production`. No direct commits to staging/production. Tests and typecheck are the merge gate. Runtime activation is verified after staging merge; it does not block pre-merge review. Production promotion follows successful activation testing.

## Continuous operation

Default to action on reversible routine choices. Self-report idle or rate-limited states. For longer work, inspect objective Git/check state at least hourly rather than trusting terminal text.

## Coding discipline

Ponytail full, enforced by `AGENTS.md` and QA. Security, trust-boundary validation, cancellation and data-loss prevention are not simplification targets.

## Standing tasks

- Production promotion: ready; authenticated global smoke test passed on 2026-07-14.
- Public remote alignment: push all three branches and set `production` as default after QA promotion.
- Maintenance: run `npm run verify`, Opus review, staging validation, then production promotion for every release.

## Model assignment

Opus 4.8 is assigned to QA because this extension handles credentials, arbitrary mutations and local-file uploads. The current strong coding model owns implementation. A separate Docs Pi is unnecessary at this project size; Docs/Ops remains mechanical work in the orchestrator session.
