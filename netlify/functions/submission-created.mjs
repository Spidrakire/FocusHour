import { getStore } from '@netlify/blobs';
import { enqueue, drain, syncContact } from '../registration-sync.mjs';
import { queueWelcome, deliverQueuedEmails } from '../operational-email-queue.mjs';
import { recordVerifiedRegistration, registrationKey } from '../verified-members.mjs';

// Legacy Netlify Forms event: only verified submissions invoke this handler.
// Production-only GOOGLE_MEET_URL gates shared Blobs against preview writes.
export default async function (request) {
  if (!process.env.GOOGLE_MEET_URL) return new Response(null, { status: 204 });
  const { payload } = await request.json();
  if (payload?.form_name !== 'focus-hour-registration') return new Response(null, { status: 204 });

  // Prioritise immediate joining details over optional CRM synchronisation.
  // Preserve the first verified trial when a person submits the form again.
  let registration;
  try {
    const members = getStore({ name: 'focus-hour-verified-members', consistency: 'strong' });
    ({ registration } = await recordVerifiedRegistration(members, payload));
    const emails = getStore({ name: 'focus-hour-operational-email', consistency: 'strong' });
    await queueWelcome(emails, registration);
    if (process.env.BREVO_API_KEY) {
      await deliverQueuedEmails(emails, {
        apiKey: process.env.BREVO_API_KEY,
        meetUrl: process.env.GOOGLE_MEET_URL,
        // Any pending reminder must still pass its latest eligibility check.
        getCurrentRegistration: email => members.get(
          registrationKey(email), { type: 'json' }),
      });
    } else {
      console.error('Welcome queued: Brevo API key unavailable');
    }
  } catch (error) {
    console.error('Verified registration or welcome delivery requires reconciliation', error?.name ?? 'error');
  }

  // A failed CRM sync must never prevent the joining email being attempted.
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    try {
      const store = getStore({ name: 'brevo-registration', consistency: 'strong' });
      await enqueue(store, payload);
      await drain(store, job => syncContact(job, apiKey));
    } catch (error) {
      console.error('Brevo contact sync deferred to scheduled retry', error?.name ?? 'error');
    }
  }
  return new Response(null, { status: 204 });
}
