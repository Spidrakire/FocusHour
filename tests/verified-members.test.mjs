import test from 'node:test';
import assert from 'node:assert/strict';
import { recordVerifiedRegistration, registrationKey, verifiedMembers } from '../netlify/verified-members.mjs';
import { eligibleForReminder } from '../netlify/operational-emails.mjs';

function store() {
  const items = new Map();
  return {
    async setJSON(key, value, options = {}) {
      if (options.onlyIfNew && items.has(key)) return { modified: false };
      items.set(key, structuredClone(value));
      return { modified: true };
    },
    async get(key) { return structuredClone(items.get(key) ?? null); },
    async *list({ prefix }) {
      yield { blobs: [...items.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) };
    },
  };
}
const payload = (id, email = 'ada@example.com', start = '2026-11-16') => ({
  id, data: { email, name: 'Ada', 'first-session-date': start },
});
test('verified member is stored once and repeated form cannot restart trial', async () => {
  const s = store();
  const first = await recordVerifiedRegistration(s, payload('form_1'));
  assert.equal(first.newMember, true);
  const second = await recordVerifiedRegistration(s, payload('form_2', 'ADA@example.com', '2026-12-14'));
  assert.equal(second.newMember, false);
  assert.equal(second.registration.firstSessionDate, '2026-11-16');
  assert.equal(second.registration.id, 'form_1');
  assert.equal(eligibleForReminder(second.registration, '2026-12-14'), false);
  assert.equal(registrationKey('ADA@example.com'), registrationKey('ada@example.com'));
  assert.equal((await Array.fromAsync(verifiedMembers(s))).length, 1);
});
test('invalid unverified-shaped events cannot create a booking', async () => {
  const s = store();
  await assert.rejects(recordVerifiedRegistration(s, payload('bad/id')), /Invalid verified/);
  await assert.rejects(recordVerifiedRegistration(s, payload('form_3', 'ada@example.com', '2026-11-17')), /Invalid verified/);
});
test('cancelled and expired memberships cannot receive reminders', async () => {
  const s = store();
  const { registration } = await recordVerifiedRegistration(s, payload('form_1'));
  assert.equal(eligibleForReminder(registration, '2026-11-23'), true);
  assert.equal(eligibleForReminder({ ...registration, cancelled: true }, '2026-11-23'), false);
  assert.equal(eligibleForReminder({ ...registration, membershipStatus: 'EXPIRED' }, '2026-11-23'), false);
});
