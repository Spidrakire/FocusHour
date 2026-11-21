# Focus Hour: essential registration welcome email (draft)

**Status:** draft only. No automated email delivery is implemented or enabled.

**Audience:** every successfully registered participant, regardless of optional marketing consent.

**Trigger:** immediately after Netlify Forms confirms the registration, independently of Brevo CRM synchronisation. A registration at 18:29 on a Monday must not wait for the 15-minute Brevo retry worker.

**Subject:** Welcome to Focus Hour! Your first session is booked

Hi {{FIRSTNAME}},

Welcome to Focus Hour! I'm so pleased you're joining us.

You've taken the first step towards making more time for something that matters to you.

**Your first Focus Hour**

**Date:** Monday {{FIRST_SESSION_DATE_HUMAN}}  
**Time:** 6.30–7.45pm UK time  
**Where:** Online  
**Join your session:** {{PRIVATE_JOINING_URL}}

Here's what to expect:

- **6.30–6.40pm:** Set your goal. Choose one thing you'd like to make progress on.
- **6.40–7.40pm:** Focus. Enjoy a protected hour to work quietly alongside the group.
- **7.40–7.45pm:** Celebrate. Share your progress and finish on a positive note.

**Your first four consecutive Monday sessions are completely free.** There's no payment required and no obligation to continue afterwards.

You don't need to prepare anything special. Just bring something you'd like to work on, whether that's a big ambition or a small task you've been putting off.

You don't have to finish everything. You just have to begin.

I'm looking forward to welcoming you.

See you on Monday!

Focus Hour  
*One session. One goal. One step closer.*

focushour.co.uk

## Implementation requirements

- Never place a real private meeting URL in GitHub, public HTML or public JavaScript. Store it in a protected server-side secret and deliver only to confirmed registrants.
- Keep transactional/operational delivery separate from marketing consent and from Brevo list subscription status.
- Derive the displayed date from the validated registration date, not from the current date or the date of email delivery.
- Make retries idempotent to prevent repeated welcome emails; record delivery state and errors without logging personal data or secrets.
- Render and test both GMT and BST Monday dates, including registrations shortly before the 18:30 cut-off.
- A successful website registration should provide immediate, secure access to joining instructions even if email delivery is delayed.
- Do not claim this email is active until a controlled end-to-end test proves delivery.
