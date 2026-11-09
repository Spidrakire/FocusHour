# Focus Hour email automation: deployment gate

Development branch: `registration/brevo-sync-hardening`. No production deployment is implied by these files.

## Implemented in code

- Netlify Forms remains the authoritative registration source. A legacy `submission-created` event creates a member record keyed by a SHA-256 digest of the canonical email address.
- Repeated registrations do not restart a trial. Only the original verified registration is eligible for its welcome email.
- Welcome emails include the private Google Meet link and are attempted immediately, with 15-minute scheduled retries on failures.
- A scheduled function runs at 08:00 and 09:00 UTC on Mondays, checks the actual Europe/London time and queues reminders for the current date.
- Four consecutive trial Mondays are eligible. Cancelled and expired records are excluded. Paid records require both a verified payment and an explicit booked Monday.
- Before sending a reminder, the retry worker rechecks the current member record and discards cancelled or stale reminders.
- The production-only `GOOGLE_MEET_URL` acts as a guard against writing shared Netlify Blobs from deploy previews. The meeting URL is never committed or returned to the browser.
- Unit tests use mocked Brevo responses and fake stores. No test is intended to send a live email.

## Must verify before production

1. GitHub Actions `Development tests` is green at the final commit, including the verified member and reminder tests.
2. Confirm Netlify's actual verified form event payload has `payload.form_name`, `payload.id` and `payload.data` matching the legacy handler. If not, adapt to the current `formSubmitted` event format and add an integration test.
3. Confirm both `BREVO_API_KEY` and `GOOGLE_MEET_URL` are available to **production Functions**. Never paste either secret into GitHub.
4. Verify the Netlify Blobs queue and ledger persist in the correct site and have appropriate retention, access and operational monitoring.
5. Use a controlled registration with an address the operator owns. Check the Forms record, ledger, Brevo contact, welcome message and Meet link.
6. Test duplicate submissions, cancelled members, expired trials and a Monday reminder in both GMT and BST. Check provider acceptance and actual inbox delivery.
7. Check scheduled function run times, retry logs and manual reconciliation procedures. Netlify scheduled functions use UTC and run automatically only on published deploys.
8. Confirm the approach to membership payment, cancellations, data deletion and account support before inviting paid members.

## Known limitations

- Email delivery is at least once: if Brevo accepts a message but the function crashes before writing the success marker, a retry may duplicate it. This cannot be claimed to be exactly once.
- Queue retries stop automatically after eight failures and require operator reconciliation.
- The Monday reminder scan has a time budget and logs when incomplete. Larger member volumes need a cursor-based worker or transactional database.
- The member ledger does not yet have a customer self-service cancellation/payment update path. Do not advertise an automated paid subscription as working.
- A public receipt cannot safely expose the private Meet URL. The thank-you page confirms the booking without the link; joining details are delivered to the email address.
- Production Netlify Forms event wiring and actual inbox delivery have not been verified.

## Release

Do not merge to `main` or deploy to the production Netlify site until the above gates pass. A GitHub test pass alone does not verify the hosted integration.
