# Focus Hour: essential session reminder email (draft)

**Status:** copy only, not implemented, scheduled or sent.

**Audience:** registered participants whose four consecutive trial Mondays include the session date, and paying members with access to that session. Do not treat marketing consent as a condition for operational reminders.

**Suggested timing:** the morning of each Monday session, UK local time. Same-day registrants must receive their immediate welcome/joining instructions rather than waiting for a scheduled reminder.

**Subject:** Your Focus Hour is tonight at 6.30pm

Hi {{FIRSTNAME}},

A quick reminder that **Focus Hour is tonight, 6.30–7.45pm UK time**.

**Join online:** {{PRIVATE_JOINING_URL}}

Bring one thing you'd like to make progress on. It could be something you've been meaning to start, a project that's stalled or a task that deserves your full attention.

We'll spend 10 minutes setting our goals, 60 minutes working quietly and 5 minutes sharing our progress.

There's nothing you need to prepare. Just come as you are and give yourself this protected time.

See you this evening!

Focus Hour  
*One session. One goal. One step closer.*

focushour.co.uk

## Delivery safeguards

- Calculate eligibility from the registered first Monday and the next three consecutive Mondays, not from attendance. For paid members, use verified membership status.
- Use the Europe/London time zone so the reminder stays correct across GMT and BST.
- Do not send a reminder for a session already finished or to somebody who is not eligible.
- Keep private meeting URLs in protected server-side configuration, never in public assets or repository files.
- Track delivery attempts by recipient and session date to avoid duplicate sends.
- Suppress only non-essential marketing based on marketing consent; essential session messages have a separate purpose.
- Do not claim reminder automation is active until end-to-end delivery is verified.
