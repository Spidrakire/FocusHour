# Controlled deployment runbook (not yet authorised)

## Safety boundaries
- Do not modify `main`, merge, open a PR, deploy or change live Netlify/Brevo services without explicit approval.
- Production domain: `focushour.co.uk`. Netlify production branch: `main`. Branch deploys disabled; PR Deploy Previews may build and consume credits.
- Development branch: `registration/brevo-sync-hardening`. Original integration: `registration/brevo-sync`.
- Do not use a production API key in a preview context or send test registrations into the real Brevo list without authorisation.

## Before requesting deployment approval
1. Run `npm ci` with Node 22 or newer, then `node --test tests/*.test.mjs`; retain the test output.
2. Verify Netlify event function format against current documentation and write an integration-level test for the actual payload. Do not assume the filename `submission-created.mjs` alone proves delivery.
3. Verify Netlify Blobs' conditional writes, response shapes and scheduled function support against the installed SDK.
4. Confirm the Forms name `focus-hour-registration`, expected field names, Edge Function date gate and server-side date validation.
5. Confirm `BREVO_API_KEY` is scoped to the intended production Functions runtime, without viewing or exposing the value.
6. Confirm Brevo list ID 6 and types for `FIRSTNAME`, `FIRST_SESSION_DATE`, `MARKETING_CONSENT` and `MEMBERSHIP_STATUS`.
7. Review the joining-email draft in `docs/welcome-email-draft.md`. The joining URL must be stored as a secret, not committed.
8. Decide how preview test data will be isolated from production data and emails. Ensure the preview is not indexed or promoted to production.

## Authorised controlled test
1. After explicit approval, create a PR only if its preview behaviour and credit usage are understood.
2. Inspect the preview deployment log, form detection and Function/Edge Function activation.
3. Test date options in GMT and BST, including the Monday 18:29:59 / 18:30:00 boundary.
4. Submit one authorised synthetic registration. Confirm it is stored by Netlify Forms and the website success state displays the correct four Monday dates.
5. Check the verified submission event reached the queue, the immediate Brevo call completed and the contact appears in the correct list with the right attributes. Confirm opt-out stays opt-out.
6. Simulate transient and permanent Brevo failures in an isolated test environment; verify retries, deduplication and visibility for failed jobs.
7. Test essential welcome email delivery separately once implemented, including last-minute Monday registration and a failure/retry scenario. Never use the real private meeting link in logs or public assets.
8. Record results, costs and unresolved issues. Do not merge or publish without a second explicit approval.

## Release blockers
- Automated joining email and secure immediate joining details are not implemented.
- Netlify hosted submission event delivery and Brevo connectivity are not verified.
- The new tests have not yet been executed in an environment with the repository and Node runtime.
- Any permanent failure or missing API key requires reconciliation against Netlify Forms.
