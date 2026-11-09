import { getStore } from '@netlify/blobs';
import { enqueue, drain, syncContact } from '../registration-sync.mjs';

// Netlify invokes this legacy event handler only after a form submission is verified.
// Queue the record first, then attempt the Brevo sync immediately. The scheduled
// worker independently retries jobs if Brevo is unavailable or this invocation fails.
export default async function (request) {
  const { payload } = await request.json();
  if (payload?.form_name !== 'focus-hour-registration') return new Response(null, { status: 204 });

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('Brevo registration sync skipped: BREVO_API_KEY unavailable at runtime');
    return new Response(null, { status: 204 });
  }

  const store = getStore({ name: 'brevo-registration', consistency: 'strong' });
  try {
    await enqueue(store, payload);
  } catch (error) {
    // Netlify Forms is the source of truth: do not log personal registration data.
    console.error('Brevo registration could not be queued', error?.name ?? 'error');
    throw error;
  }

  try {
    await drain(store, registration => syncContact(registration, apiKey));
  } catch (error) {
    // The durable queue remains available for the scheduled retry worker.
    console.error('Immediate Brevo registration sync deferred to retry worker', error?.name ?? 'error');
  }
  return new Response(null, { status: 204 });
}
