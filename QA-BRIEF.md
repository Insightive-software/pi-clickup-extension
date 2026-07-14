# QA Pi Brief

You are reviewer-of-record for `pi-clickup`, running Claude Opus 4.8.

Review `development` against `staging`. Check:

1. Full ClickUp v2/v3 path, query, JSON and multipart support.
2. Token secrecy, fixed-host enforcement, prompt-injection/file-upload risk and DELETE confirmation.
3. 429 handling, safe retry semantics, cancellation, timeouts, errors and output truncation.
4. Official OpenAPI discovery for all current operations.
5. Pi extension API correctness and Google-compatible schemas.
6. Ponytail: identify unnecessary code/dependencies without sacrificing requirements.
7. Run `npm run verify` and a no-token Pi smoke test.

On FAIL, write precise findings and do not merge. On PASS, merge `development` into `staging`; do not promote `staging` to `production` until activation testing is complete.
