# PROJECT STATUS — Pi ClickUp

## Goal and current phase

Build a global Pi extension that replaces unstable ClickUp MCP/API tooling with direct, complete ClickUp Public API v2/v3 control. Current phase: operational maintenance. Core implementation, public-repository onboarding, Opus 4.8 QA, global installation, authenticated read-only validation, production promotion, and public CI are complete. The public repository uses `production` as its default branch.

## Source of truth

| Area | Source |
|---|---|
| Code, specs, checks | `https://github.com/umar-rana/pi-clickup-extension` and this local checkout |
| API contract | Official ClickUp v2/v3 OpenAPI specifications |
| Coordination | `PROJECT_STATUS.md` |
| New-Pi onboarding | `NTS-PICU-NewPiHandoff-0001.md` |
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

- Maintenance: run `npm run verify`, Opus review, staging validation, then production promotion for every release.
- OpenAPI drift: no scheduled work; `clickup_docs` loads ClickUp's official specifications at runtime.

## Model assignment

Opus 4.8 is assigned to QA because this extension handles credentials, arbitrary mutations and local-file uploads. The current strong coding model owns implementation. A separate Docs Pi is unnecessary at this project size; Docs/Ops remains mechanical work in the orchestrator session.
