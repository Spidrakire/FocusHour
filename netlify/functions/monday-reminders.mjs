import { getStore } from '@netlify/blobs';
import { londonParts, londonSessionDate } from '../operational-emails.mjs';
import { verifiedMembers, registrationKey } from '../verified-members.mjs';
import { queueReminder, deliverQueuedEmails } from '../operational-email-queue.mjs';

// Netlify cron is UTC. 08:00 UTC is 09:00 BST; 09:00 UTC is 09:00 GMT.
// Each invocation checks the London clock so only the correct run sends.
// The booking date in the queue key prevents repeated reminders.
export const config = { schedule: '0 8,9 * * 1' };

export default async function () {
  const now = new Date();
  const parts = londonParts(now);
  // Allow scheduler jitter up to 20 minutes, never send before 09:00 London.
  if (parts.weekday !== 'Mon' || parts.hour !== '09' || Number(parts.minute) > 20) return;
  const apiKey = process.env.BREVO_API_KEY;
  const meetUrl = process.env.GOOGLE_MEET_URL;
  if (!apiKey || !meetUrl) {
    console.error('Monday reminders not configured');
    return;
  }
  const members = getStore({ name: 'focus-hour-verified-members', consistency: 'strong' });
  const emails = getStore({ name: 'focus-hour-operational-email', consistency: 'strong' });
  const sessionDate = londonSessionDate(now);
  const started = Date.now();
  for await (const member of verifiedMembers(members)) {
    if (Date.now() - started > 18000) {
      console.error('Monday reminder scan incomplete: investigate capacity');
      break;
    }
    await queueReminder(emails, member, sessionDate);
  }
  await deliverQueuedEmails(emails, {
    apiKey, meetUrl,
    getCurrentRegistration: email => members.get(registrationKey(email), { type: 'json' }),
  });
}
