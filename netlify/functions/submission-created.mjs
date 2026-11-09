import { getStore } from '@netlify/blobs';
import { enqueue, drain, syncContact } from '../registration-sync.mjs';
import { queueWelcome, deliverQueuedEmails } from '../operational-email-queue.mjs';

// Netlify invokes this legacy event handler only after a form submission is verified.
// Queue the record first, then attempt the Brevo sync immediately. The scheduled
// worker independently retries jobs if Brevo is unavailable or this invocation fails.
export default async function (request) {
  const { payload } = await request.json();
  if (payload?.form_name !== 'focus-hour-registration') return new Response(null, { status: 204 });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) console.error('Brevo registration sync skipped: BREVO_API_KEY unavailable at runtime');

  if (apiKey) {
    const store = getStore({ name: 'brevo-registration', consistency: 'strong' });
    try {
      await enqueue(store, payload);
      await drain(store, registration => syncContact(registration, apiKey));
    } catch (error) {
      console.error('Brevo registration sync deferred to reconciliation', error?.name ?? 'error');
    }
  }
  // Welcome delivery is independent of the contact synchronisation result.
  // Only verified form-submission events may reach this handler.
  try {
    const emailStore = getStore({ name: 'focus-hour-operational-email', consistency: 'strong' });
    await queueWelcome(emailStore, {
      id: payload.id,
      email: payload.data?.email?.trim().toLowerCase(),
      firstName: payload.data?.name?.trim(),
      firstSessionDate: payload.data?.['first-session-date'],
    });
    if (process.env.GOOGLE_MEET_URL) {
      await deliverQueuedEmails(emailStore, {
        apiKey,
        meetUrl: process.env.GOOGLE_MEET_URL,
      });
    } else {
      console.error('Operational welcome queued but meeting URL unavailable');
    }
  } catch (error) {
    console.error('Operational welcome delivery deferred', error?.name ?? 'error');
  }
  return new Response(null, { status: 204 });
}
