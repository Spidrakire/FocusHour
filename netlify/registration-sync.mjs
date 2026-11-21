const listIds = [6];
const retryable = status => status === 408 || status === 425 || status === 429 || status >= 500;

export async function enqueue(store, { id, data }) {
  const email = data?.email?.trim().toLowerCase();
  const firstName = data?.name?.trim();
  const firstSession = data?.['first-session-date'];
  const consent = data?.MARKETING_CONSENT;
  if (!/^[\w-]+$/.test(id ?? '') || !email || !firstName ||
      !/^\d{4}-\d{2}-\d{2}$/.test(firstSession ?? '') ||
      !['true', 'false'].includes(consent)) {
    throw new Error('Invalid registration sync payload');
  }

  if (await store.get(`done/${id}`)) return;
  await store.setJSON(`pending/${id}`, {
    email,
    attributes: {
      FIRSTNAME: firstName,
      FIRST_SESSION_DATE: firstSession,
      MARKETING_CONSENT: consent === 'true',
    },
    attempts: 0,
    nextAttempt: 0,
  }, { onlyIfNew: true });
}

export async function syncContact({ email, attributes }, apiKey, fetcher = fetch) {
  async function request(method, path, body) {
    try {
      return await fetcher(`https://api.brevo.com/v3/contacts${path}`, {
        method,
        headers: { 'api-key': apiKey, 'content-type': 'application/json' },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(2500),
        redirect: 'error',
      });
    } catch {
      return null;
    }
  }

  function outcome(response) {
    if (response?.ok) return { done: true };
    const status = response?.status;
    const retryAfter = response?.headers.get('retry-after');
    const seconds = Number(retryAfter);
    const retryAt = retryAfter && (Number.isFinite(seconds)
      ? Date.now() + seconds * 1000 : Date.parse(retryAfter));
    return { retry: !status || retryable(status), retryAt, status };
  }

  const path = `/${encodeURIComponent(email)}?identifierType=email_id`;
  const existing = await request('GET', path);
  if (existing?.status === 404) {
    const created = await request('POST', '', {
      email,
      attributes: { ...attributes, MEMBERSHIP_STATUS: 'FREE_TRIAL' },
      listIds,
      updateEnabled: false,
    });
    // Another writer may have created the contact since the lookup.
    if (created?.status === 409 ||
        (created?.status === 400 && (await created.json().catch(() => null))?.code === 'duplicate_parameter')) {
      return { retry: true, status: created.status };
    }
    return outcome(created);
  }
  if (!existing?.ok) return outcome(existing);

  const contact = await existing.json().catch(() => null);
  if (!contact || typeof contact.attributes !== 'object' || contact.attributes === null) {
    return { retry: true };
  }
  const status = contact.attributes.MEMBERSHIP_STATUS;
  const changes = status == null || (typeof status === 'string' && !status.trim())
    ? { ...attributes, MEMBERSHIP_STATUS: 'FREE_TRIAL' }
    : attributes;
  return outcome(await request('PUT', path, { attributes: changes, listIds }));
}

export async function drain(store, sync, now = Date.now, report = console.error) {
  const started = now();
  const pages = store.list({ prefix: 'pending/', paginate: true });
  for await (const { blobs } of pages) {
    for (const { key } of blobs) {
      if (now() - started >= 20_000) return;
      const completed = key.replace(/^pending\//, 'done/');
      if (await store.get(completed)) {
        await store.delete(key);
        continue;
      }

      const entry = await store.getWithMetadata(key, { type: 'json' });
      if (!entry || entry.data.nextAttempt > now() || entry.data.failed) continue;
      const job = entry.data;
      const lease = await store.setJSON(key, { ...job, nextAttempt: now() + 60_000 }, {
        onlyIfMatch: entry.etag,
      });
      if (!lease.modified) continue;

      const result = await sync(job);
      if (result.done) {
        await store.set(completed, 'synced', { onlyIfNew: true });
        await store.delete(key);
      } else {
        const attempts = job.attempts + 1;
        const delay = Math.min(24 * 60, 15 * 2 ** (attempts - 1)) * 60_000;
        await store.setJSON(key, {
          ...job,
          attempts,
          failed: !result.retry,
          nextAttempt: Math.max(now() + delay, result.retryAt || 0),
        }, { onlyIfMatch: lease.etag });
        report('Brevo registration sync failed', key, result.status ?? 'network', attempts);
      }
    }
  }
}
