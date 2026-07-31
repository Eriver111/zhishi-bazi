# Task 1 Report: Always-Visible Customer Service Card

## RED evidence

Created `tests/profile-customer-service.test.js` before production changes. The initial focused run failed as expected because `#profileCustomerService` and `window.copyProfileWechat` did not exist:

- card placement assertion failed;
- Clipboard API path could not find `copyProfileWechat`;
- rejected-Clipboard fallback path could not find `copyProfileWechat`.

## GREEN evidence

After the implementation:

- `node --test tests/profile-customer-service.test.js` passed: 3 tests, 3 passed.
- `node --test tests/profile-customer-service.test.js tests/profile-report-library.test.js` passed: 8 tests, 8 passed.

## UI and copy decisions

- Added the customer-service card directly after `#content`, so it remains visible independently of logged-in state and account/API rendering.
- Kept it in normal document flow with the existing light-page visual language: a restrained red primary action, green WeChat detail, bordered depth, and responsive mobile action stacking.
- Both controls are semantic `type="button"` buttons with a 44px mobile minimum height. Feedback updates an inline live status rather than opening a dialog.
- `copyProfileWechat` first calls `navigator.clipboard.writeText('EriverLife')`; missing or rejected Clipboard API calls use a temporary textarea and `document.execCommand('copy')`, always removing the temporary node. Button/status feedback communicates success and failure without unhandled rejections.

## Self-review

- Verified the card is outside `#content`, has no fixed positioning, and does not auto-open a dialog.
- Verified existing profile rendering, credits, invitations, purchases, saved charts, and report-library code remain intact.
- `git diff --check` completed without whitespace errors.
- No `.data-store.json` artifact exists.
- Left the pre-existing untracked `.superpowers/brainstorm/` directory untouched.

## Commit

`feat: add customer service to profile`

## Concerns

None. The fallback uses `document.execCommand('copy')` only for older or blocked Clipboard API contexts, and gives the visitor a clear manual-copy path if the browser blocks it too.
