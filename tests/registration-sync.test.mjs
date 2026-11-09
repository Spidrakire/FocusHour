import test from 'node:test';
import assert from 'node:assert/strict';
import { drain, enqueue, syncContact } from '../netlify/registration-sync.mjs';

const payload = {
  id: 'submission-1',
  data: { email: ' Ada@example.com ', name: 'Ada', 'first-session-date': '2026-11-09', MARKETING_CONSENT: 'false' },
};
const attributes = { FIRSTNAME: 'Ada', FIRST_SESSION_DATE: '2026-11-09', MARKETING_CONSENT: false };
const registration = { email: 'ada@example.com', attributes };

function mockStore() {
  const entries = new Map();
  let version = 0;
  return {
    async get(key) { return entries.get(key)?.data ?? null; },
    async getWithMetadata(key) { return structuredClone(entries.get(key) ?? null); },
    async set(key, data, { onlyIfNew, onlyIfMatch }) {
      const entry = entries.get(key);
      if ((onlyIfNew && entry) || (onlyIfMatch && onlyIfMatch !== entry?.etag)) {
        return { modified: false };
      }
      const etag = String(++version);
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

function mockBrevo(responses) {
  const calls = [];
  return {
    calls,
    async fetcher(url, options) {
      calls.push({ url, method: options.method, body: options.body && JSON.parse(options.body) });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'unexpected Brevo request');
      return response;
    },
  };
}

test('creates a free trial in list 6 without setting email preferences', async () => {
  const { calls, fetcher } = mockBrevo([new Response(null, { status: 404 }), new Response(null, { status: 201 })]);
  assert.deepEqual(await syncContact(registration, 'test-key', fetcher), { done: true });
  assert.match(calls[0].url, /ada%40example\.com\?identifierType=email_id$/);
  assert.equal(calls[1].method, 'POST');
  assert.deepEqual(calls[1].body, {
    email: registration.email, attributes: { ...attributes, MEMBERSHIP_STATUS: 'FREE_TRIAL' },
    listIds: [6], updateEnabled: false,
  });
});

for (const membership of ['PAID', undefined]) {
  test(`updates an existing contact with membership ${membership}`, async () => {
    const { calls, fetcher } = mockBrevo([
      Response.json({ emailBlacklisted: true, attributes: { MEMBERSHIP_STATUS: membership } }),
      new Response(null, { status: 204 }),
    ]);
    const optedIn = { ...attributes, MARKETING_CONSENT: true };
    assert.deepEqual(await syncContact({ ...registration, attributes: optedIn }, 'test-key', fetcher), { done: true });
    assert.equal(calls[1].method, 'PUT');
    assert.deepEqual(calls[1].body, {
      attributes: membership ? optedIn : { ...optedIn, MEMBERSHIP_STATUS: 'FREE_TRIAL' },
      listIds: [6],
    });
  });
}

test('retries network failures, throttling and concurrent creation, but not invalid credentials', async () => {
  for (const [response, retry] of [
    [new Error('private details'), true],
    [new Response(null, { status: 429, headers: { 'retry-after': '3600' } }), true],
    [new Response(null, { status: 503 }), true],
    [new Response(null, { status: 401 }), false],
  ]) {
    const { fetcher } = mockBrevo([response]);
    const result = await syncContact(registration, 'test-key', fetcher);
    assert.equal(result.retry, retry);
    if (result.status === 429) assert.ok(result.retryAt > Date.now() + 3_590_000);
  }
  const { fetcher } = mockBrevo([
    new Response(null, { status: 404 }),
    Response.json({ code: 'duplicate_parameter' }, { status: 400 }),
  ]);
  assert.equal((await syncContact(registration, 'test-key', fetcher)).retry, true);
});

test('queues once, retries after the requested delay and skips a completed submission', async () => {
  const store = mockStore();
  await Promise.all([enqueue(store, payload), enqueue(store, payload)]);
  let time = 100;
  let calls = 0;
  const sync = async job => {
    assert.deepEqual(job.attributes, attributes);
    assert.equal(job.email, registration.email);
    return ++calls === 1 ? { retry: true, retryAt: 3_600_100, status: 429 } : { done: true };
  };
  const run = () => drain(store, sync, () => time, () => {});
  await Promise.all([run(), run()]);
  assert.equal(calls, 1);
  await enqueue(store, payload);
  time += 900_000;
  await run();
  assert.equal(calls, 1);
  time = 3_600_100;
  await Promise.all([run(), run()]);
  await enqueue(store, payload);
  await run();
  assert.equal(calls, 2);
  assert.equal(await store.get('pending/submission-1'), null);
});

test('recovers an expired claim after interruption', async () => {
  const store = mockStore();
  await enqueue(store, payload);
  await assert.rejects(drain(store, async () => { throw new Error('interrupted'); }, () => 0));
  await drain(store, async () => assert.fail('claim still active'), () => 59_999);
  await drain(store, async () => ({ done: true }), () => 60_000);
  assert.equal(await store.get('done/submission-1'), 'synced');
});


test('permanent Brevo failures remain available for investigation without repeated calls', async () => {
  const store = mockStore();
  await enqueue(store, payload);
  let calls = 0;
  const sync = async () => {
    calls++;
    return { retry: false, status: 401 };
  };
  await drain(store, sync, () => 0, () => {});
  assert.equal(calls, 1);
  const pending = await store.get('pending/submission-1');
  assert.equal(pending.failed, true);
  assert.equal(pending.attempts, 1);
  assert.equal(await store.get('done/submission-1'), null);
  await drain(store, sync, () => 86_400_000, () => {});
  assert.equal(calls, 1, 'permanent failure must not be retried indefinitely');
});

test('marketing opt-out remains false for a new contact', async () => {
  const { calls, fetcher } = mockBrevo([
    new Response(null, { status: 404 }),
    new Response(null, { status: 201 }),
  ]);
  await syncContact(registration, 'test-key', fetcher);
  assert.equal(calls[1].body.attributes.MARKETING_CONSENT, false);
  assert.equal(Object.hasOwn(calls[1].body, 'emailBlacklisted'), false);
});
