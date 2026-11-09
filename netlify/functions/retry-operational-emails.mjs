import { getStore } from '@netlify/blobs';
import { deliverQueuedEmails } from '../operational-email-queue.mjs';
import { registrationKey } from '../verified-members.mjs';

// Retry previously queued welcome emails. This worker does not create reminders.
// The Monday 9am scheduler must not be enabled until verified booking records
// and cancellation/payment checks are available.
export const config = { schedule: '*/15 * * * *' };

export default async function () {
  // The meeting URL is provisioned for production only; never touch shared Blobs in previews.
  if (!process.env.GOOGLE_MEET_URL) return;
  const apiKey = process.env.BREVO_API_KEY;
  const meetUrl = process.env.GOOGLE_MEET_URL;
  if (!apiKey || !meetUrl) {
    console.error('Operational email retry skipped: required runtime configuration unavailable');
    return;
  }
  await deliverQueuedEmails(
    getStore({ name: 'focus-hour-operational-email', consistency: 'strong' }),
    { apiKey, meetUrl,
      getCurrentRegistration: email => getStore({ name: 'focus-hour-verified-members', consistency: 'strong' })
        .get(registrationKey(email), { type: 'json' }),
    },
  );
}
