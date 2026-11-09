import test from 'node:test';
import assert from 'node:assert/strict';
import { queueWelcome, queueReminder, deliverQueuedEmails } from '../netlify/operational-email-queue.mjs';

function store() {
  const entries = new Map();
  let n = 0;
  return {
    async get(key) { return entries.get(key)?.data ?? null; },
    async getWithMetadata(key) { return structuredClone(entries.get(key) ?? null); },
    async set(key, data, options = {}) {
      const old = entries.get(key);
      if ((options.onlyIfNew && old) || (options.onlyIfMatch && options.onlyIfMatch !== old?.etag)) return { modified: false };
      const etag = String(++n);
      entries.set(key, { data: structuredClone(data), etag });
      return { modified: true, etag };
    },
    async setJSON(...args) { return this.set(...args); },
    async delete(key) { entries.delete(key); },
    async *list({ prefix }) {
      yield { blobs: [...entries.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) };
    },
  };
}
const registration = { id: 'form_1', email: 'test@example.com', firstName: 'Ada',
  firstSessionDate: '2026-11-16', membershipStatus: 'FREE_TRIAL', booked: true };
const opts = { apiKey: 'mock', meetUrl: 'https://meet.google.com/abc-defg-hij', now: () => 1000, report() {} };
test('queues one welcome and marks successful delivery', async () => {
  const s = store();
  await queueWelcome(s, registration);
  await queueWelcome(s, registration);
  let sends = 0;
  await deliverQueuedEmails(s, { ...opts, fetcher: async () => { sends++; return new Response(null, { status: 201 }); } });
  await deliverQueuedEmails(s, { ...opts, fetcher: async () => { sends++; return new Response(null, { status: 201 }); } });
  assert.equal(sends, 1);
  assert.equal(await s.get('done/welcome/form_1'), 'accepted');
});
test('retries failed delivery without exposing private data in error logs', async () => {
  const s = store();
  await queueWelcome(s, registration);
  const logs = [];
  await deliverQueuedEmails(s, { ...opts, report: (...args) => logs.push(args.join(' ')),
    fetcher: async () => new Response(null, { status: 503 }) });
  assert.equal((await s.get('pending/welcome/form_1')).attempts, 1);
  assert.ok(!logs.join(' ').includes(registration.email));
  assert.ok(!logs.join(' ').includes(opts.meetUrl));
  let sends = 0;
  await deliverQueuedEmails(s, { ...opts, now: () => 61_000,
    fetcher: async () => { sends++; return new Response(null, { status: 201 }); } });
  assert.equal(sends, 1);
});
test('only verified booked and eligible members can be queued for a reminder', async () => {
  const s = store();
  assert.equal(await queueReminder(s, registration, '2026-11-23'), true);
  assert.equal(await queueReminder(s, { ...registration, booked: false }, '2026-11-23'), false);
  assert.equal(await queueReminder(s, registration, '2026-12-14'), false);
});
