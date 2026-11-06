import { getStore } from '@netlify/blobs';
import { enqueue } from '../registration-sync.mjs';

export default async function (request) {
  const { payload } = await request.json();
  if (payload?.form_name === 'focus-hour-registration' && process.env.BREVO_API_KEY) {
    await enqueue(getStore({ name: 'brevo-registration', consistency: 'strong' }), payload);
  }
  return new Response(null, { status: 204 });
}
