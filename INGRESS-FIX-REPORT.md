# Feedback ingress limit report

## Outcome

The custom Node server now enforces a 4096-byte request-body limit only for
`/api/feedback`, before the complete body is retained or parsed.

- A declared `Content-Length` above 4096 is rejected immediately with HTTP 413.
- Chunked or undeclared bodies are counted as buffers arrive and are rejected as
  soon as the streamed total exceeds 4096 bytes.
- Oversized requests are drained, retained chunks are released, and stream
  errors are handled without invoking the API handler or sending a second
  response.
- Bodies at or below 4096 bytes keep the existing JSON/form parsing behavior.
- Other API routes continue to use the existing unrestricted body reader.
- The Vercel-side validation in `api/feedback.js` was not changed.

## TDD evidence

The new integration test starts the real `server.js` process and exercises its
HTTP ingress path. Before the implementation change, the two oversize tests
failed because the server waited for each incomplete request to end:

```text
tests 4
pass 2
fail 2
Error: server buffered the incomplete oversized request instead of rejecting it
```

After the implementation, all four ingress cases passed.

## Verification

```powershell
node --test tests\server-feedback-ingress.test.js tests\feedback-api.test.js
# 31 passed, 0 failed

$tests = Get-ChildItem tests -Filter *.test.js | ForEach-Object FullName
node --test $tests
# 270 passed, 0 failed

node --check server.js
# exit 0

git diff --check
# exit 0
```

The first sandboxed full-suite attempt could not resolve the worktree's
externally linked dependencies for three existing poster/PDF tests. The same
full command was rerun with access to that dependency location and all 270
tests passed.

Generated `.data-store.json` test data was removed. No push or deployment was
performed.

## Concerns

No known functional concerns remain. The server continues to require and parse
larger request bodies on non-feedback API routes by design.
