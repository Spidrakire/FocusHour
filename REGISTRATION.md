# Focus Hour registration

Netlify Forms is the registration system of record. Verified registrations are queued for contact synchronisation with Brevo.

## Deploy and verify before accepting registrations

1. Deploy this repository on Netlify, with publish directory `.` (set in `netlify.toml`). Enable Forms detection, then redeploy. Confirm `focus-hour-registration` appears in the Forms dashboard with `name`, `email`, `goal`, `MARKETING_CONSENT`, `first-session-date` and the honeypot.
2. Confirm the `registration` Edge Function is deployed on `/*`. GET `/api/session-dates` must return two ISO dates and `Cache-Control: no-store`. GitHub Pages and a plain static server cannot run this endpoint: the form deliberately stays disabled there.
3. POST a synthetic registration with an expired start date to `/` and `/thanks.html`. Expect HTTP 400, and confirm neither appears in Forms. This checks that direct POSTs cannot bypass the date gate.
4. Submit an authorised test registration through the form. Confirm its first-session date and marketing preference are stored in Netlify Forms and that the confirmation page shows four Mondays. This is required to verify the interaction between Edge Functions and Netlify's Forms processing on the actual deployed site; local mocked tests do not prove hosted storage works.
5. Arrange manual email delivery of joining instructions before inviting real visitors. Confirmation promises future joining instructions, but does not claim any email was sent. No automated email integration or private meeting URL is included.

The selected first name is submitted under the existing `name` field; `first-session-date` is YYYY-MM-DD. The goal is retained. `MARKETING_CONSENT` stores the separate optional marketing choice as `true` or `false` (form-encoded strings). It defaults to `false`; essential session emails do not require marketing consent.

## Date rules

`session-dates.mjs` is shared by the browser, server gate and tests. `Intl.DateTimeFormat` with `Europe/London` derives the local calendar day and time from the server clock. Monday is available until 18:29:59…; at 18:30:00 it is replaced by the following Monday. Calendar dates are advanced by seven days, rather than adding hours across daylight-saving changes. The browser fetches server choices initially, every 30 seconds, on tab visibility and immediately before submission. A stale selection is cleared and must be chosen again. The server independently validates the POST with its current clock before passing it to Netlify Forms.

Confirmation is created only after the server's accepted response. It uses session storage, not URL parameters or private links; visiting the confirmation page without a receipt does not claim success. The in-flight guard prevents accidental double clicks, but durable deduplication after a lost response is not provided without storage. A network failure can leave submission status uncertain; the UI does not claim success in that case.

## Tests

Run `node --test tests/*.test.mjs`. Tests cover weekdays, the exact Monday boundary in GMT and BST, clock changes, year rollover, four consecutive Mondays, invalid/expired dates, honeypot and both marketing choices, direct POST rejection, and downstream storage failure.

## Brevo contact sync

The scheduled worker checks the queue every 15 minutes, even when it is empty. Keep the existing server-side `BREVO_API_KEY` available to production Functions only. Without it, the event handler and worker skip synchronisation. Before a future rollout, verify list 6 is Registration and that Brevo defines `FIRSTNAME` as text, `FIRST_SESSION_DATE` as a date, `MARKETING_CONSENT` as a boolean and `MEMBERSHIP_STATUS` with support for the value `FREE_TRIAL`.

Temporary errors are retried with backoff and respect Brevo's Retry-After header. Permanent failures remain in the queue for investigation. Match the submission ID from the function log to Netlify Forms. After fixing the cause, an operator can reset the failed queue entry for retry. If the verified event fails before the queue write, recover the registration from Forms. Successful jobs remove queued contact data and keep only a completion marker for deduplication. A worker interruption after Brevo accepts a write can cause the contact operation to be repeated.

Registration list membership and essential joining instructions are independent of the optional marketing choice. The sync leaves existing email unsubscribe settings alone and sends no emails. When a hosted check is authorised, verify the stored contact fields and list membership using an authorised synthetic registration.
