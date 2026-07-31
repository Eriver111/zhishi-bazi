# Secure Profile Feedback Final Fix Report

## Status and commit

Completed locally without push or deployment.

Implementation commit: `b12f20eab5fb15c63fa444479ddfc73e002e330d`

## RED / GREEN

The storage/API tests were written before implementation. The first RED run had 24 failures and 2 passes, demonstrating the root JSONL append, missing validation/body limits, missing rate limiting, absent storage interfaces, and missing production fail-closed behavior. A second atomic-limit RED run had 3 expected failures: the API did not pass the storage guard, two concurrent memory attempts were both accepted, and Supabase used a non-atomic insert instead of the RPC.

The frontend RED run had 2 expected failures and 11 passes: repeated copy retained two reset timers, and successful feedback immediately hid the dialog without clearing fields.

Final GREEN evidence:

- `node --test tests/feedback-api.test.js tests/profile-customer-service.test.js`: 40/40 passed.
- `node --test tests/profile-customer-service.test.js tests/profile-report-library.test.js`: 18/18 passed.
- Full `tests/*.test.js` inventory: 266/266 passed.
- `node --check api/feedback.js`: passed.
- `git diff --check`: passed before the implementation commit.

The first sandboxed full-suite attempt could not traverse the externally linked `node_modules`; the authoritative rerun with that dependency path available passed 266/266.

## Storage and rate-limit design

- `api/feedback.js` no longer imports filesystem APIs or writes `feedback.jsonl`.
- `lib/supabase.js` exposes `countRecentFeedback` and `createFeedback`.
- Configured Supabase is the durable production store. Missing or failed durable storage returns 503 and never claims success.
- Local/test fallback stores feedback only in the process-memory `memStore.feedback` array. It is excluded from `.data-store.json` loading and saving.
- The API validates the 4096-byte body limit before field validation, normalizes legacy `{message, contact, context}` callers, and preserves optional `page`.
- Anonymous `client_key` is SHA-256 of the first forwarded/client IP, the rate secret, and UTC date. No raw IP is stored or returned.
- The rolling ten-minute pre-check uses the shared Supabase count. The final insert calls `create_feedback_rate_limited`, which takes a per-client PostgreSQL advisory transaction lock and atomically rechecks the maximum of five before insert. The memory fallback performs the same check synchronously before its push.
- The feedback table has row-level security enabled with no public policy; only the server-side service role is granted execution on the atomic RPC.

## Migration and environment

Apply the new `schema.sql` feedback table, recent-count index, RLS setting, and `create_feedback_rate_limited` function before deploying the API. Production must configure `SUPABASE_URL` and the server-only `SUPABASE_KEY`.

Set `FEEDBACK_RATE_SECRET` to a long random server secret. If omitted, the API uses `TOKEN_SECRET`, then `JWT_SECRET` when available. Production without any rate secret fails closed with 503.

## Frontend behavior

After a successful submission the exact confirmation remains in the open dialog, message and contact are cleared, and focus moves to the close button. Manual close still restores the background and opener focus. Repeated copy clicks cancel the prior timer and always restore `复制微信号`.

## Self-review

- Confirmed only validated, trimmed fields plus the anonymous key and timestamp reach storage.
- Confirmed 200 is sent only after successful durable/memory storage, while 400/413/429/503 paths do not insert.
- Confirmed no feedback path calls `appendFileSync`, `writeFileSync`, or `saveStore`.
- Confirmed profile payload remains exactly `{message, contact, page: "profile"}` and legacy context remains supported.
- Confirmed success keeps the live region visible and close/Escape behavior remains accessible.
- Confirmed generated `.data-store.json` was test output (report-store tests) and removed; `feedback.jsonl` was absent.
- Confirmed `FINAL-FIX.md`, `TASK.md`, and `TASK-REPORT.md` were not staged.

## Concerns

- The schema/RPC migration and service-role credentials are mandatory before rollout; otherwise production intentionally returns 503.
- `x-forwarded-for` must be supplied by a trusted reverse proxy because the required first-address derivation relies on that boundary.
- Feedback contains user-provided contact/message data. Keep the service-role key server-only and preserve the no-public-policy RLS posture.
- The UTC-date component intentionally rotates anonymous client keys daily; this follows the requirement and avoids a stable long-lived IP-derived identifier.
