import { createHash } from 'node:crypto';
import { mondayDate } from './operational-emails.mjs';

// Created exclusively by a verified Netlify Forms event, not from a browser request.
// A person's first verified registration fixes their four-week trial start.
export function registrationKey(email) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Invalid email');
  return 'members/' + createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}
export async function recordVerifiedRegistration(store, { id, data }) {
  const email = data?.email?.trim().toLowerCase();
  const firstName = data?.name?.trim();
  const firstSessionDate = data?.['first-session-date'];
  if (!/^[\w-]{1,120}$/.test(id ?? '') || !firstName || !mondayDate(firstSessionDate)) {
    throw new Error('Invalid verified registration');
  }
  const key = registrationKey(email);
  const registration = {
    id, email, firstName, firstSessionDate,
    booked: true, cancelled: false, membershipStatus: 'FREE_TRIAL',
    paymentVerified: false, paidSessionDates: [],
  };
  const inserted = await store.setJSON(key, registration, { onlyIfNew: true });
  // Do not reset a person's trial or paid status when they submit the form again.
  const saved = await store.get(key, { type: 'json' });
  if (!saved) throw new Error('Verified registration was not persisted');
  return { registration: saved, newMember: inserted.modified === true };
}
export async function *verifiedMembers(store) {
  for await (const { blobs } of store.list({ prefix: 'members/', paginate: true })) {
    for (const { key } of blobs) {
      const member = await store.get(key, { type: 'json' });
      if (member?.id && member?.email) yield member;
    }
  }
}
