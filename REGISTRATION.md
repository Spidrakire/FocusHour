# Focus Hour registration

This static site uses Netlify Forms for storage. No payment, database or email provider is included.

## Deploy and verify before accepting registrations

1. Deploy this repository on Netlify, with publish directory `.` (set in `netlify.toml`). Enable Forms detection, then redeploy. Confirm `focus-hour-registration` appears in the Forms dashboard with `name`, `email`, `goal`, `consent`, `first-session-date` and the honeypot.
2. Confirm the `registration` Edge Function is deployed on `/*`. GET `/api/session-dates` must return two ISO dates and `Cache-Control: no-store`. GitHub Pages and a plain static server cannot run this endpoint: the form deliberately stays disabled there.
3. POST a synthetic registration with an expired start date to `/` and `/thanks.html`. Expect HTTP 400, and confirm neither appears in Forms. This checks that direct POSTs cannot bypass the date gate.
4. Submit an authorised test registration through the form. Confirm its first-session date and consent are stored in Netlify Forms and that the confirmation page shows four Mondays. This is required to verify the interaction between Edge Functions and Netlify's Forms processing on the actual deployed site; local mocked tests do not prove hosted storage works.
5. Arrange manual email delivery of joining instructions before inviting real visitors. Confirmation promises future joining instructions, but does not claim any email was sent. No automated email integration or private meeting URL is included.

The selected first name is submitted under the existing `name` field; `first-session-date` is YYYY-MM-DD. Existing goal and consent are retained.

## Date rules

`session-dates.mjs` is shared by the browser, server gate and tests. `Intl.DateTimeFormat` with `Europe/London` derives the local calendar day and time from the server clock. Monday is available until 18:29:59…; at 18:30:00 it is replaced by the following Monday. Calendar dates are advanced by seven days, rather than adding hours across daylight-saving changes. The browser fetches server choices initially, every 30 seconds, on tab visibility and immediately before submission. A stale selection is cleared and must be chosen again. The server independently validates the POST with its current clock before passing it to Netlify Forms.

Confirmation is created only after the server's accepted response. It uses session storage, not URL parameters or private links; visiting the confirmation page without a receipt does not claim success. The in-flight guard prevents accidental double clicks, but durable deduplication after a lost response is not provided without storage. A network failure can leave submission status uncertain; the UI does not claim success in that case.

## Tests

Run `node --test tests/session-dates.test.mjs`. Tests cover weekdays, the exact Monday boundary in GMT and BST, clock changes, year rollover, four consecutive Mondays, invalid/expired dates, honeypot and consent, direct POST rejection, and downstream storage failure.
