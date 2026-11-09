import { getStore } from '@netlify/blobs';
import { drain, syncContact } from '../registration-sync.mjs';

export const config = { schedule: '*/15 * * * *' };

export default async function () {
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    await drain(
      getStore({ name: 'brevo-registration', consistency: 'strong' }),
      registration => syncContact(registration, apiKey),
    );
  }
}
