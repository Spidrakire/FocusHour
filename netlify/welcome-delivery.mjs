import { welcomeEmail, sendOperationalEmail } from './operational-emails.mjs';

// A submission ID is the idempotency key. A claim is written before sending:
// this favours preventing duplicate emails over automatic retry after an
// uncertain network outcome. Operators must reconcile uncertain claims.
export async function queueWelcome(store, { id, data }) {
  const email = data?.email?.trim().toLowerCase();
  const firstName = data?.name?.trim();
  const firstSessionDate = data?.['first-session-date'];
  if (!/^[\w-]+$/.test(id ?? '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '') ||
      !firstName || !/^\d{4}-\d{2}-\d{2}$/.test(firstSessionDate ?? '')) {
    throw new Error('Invalid welcome event');
  }
  if (await store.get(`welcome-done/${id}`)) return;
  await store.setJSON(`welcome-pending/${id}`, { email, firstName, firstSessionDate },
    { onlyIfNew: true });
}
export async function deliverWelcomes(store, { apiKey, meetUrl, fetcher = fetch, report = console.error }) {
  if (!apiKey || !meetUrl) {
    report('Operational welcome delivery not configured');
    return;
  }
  for await (const { blobs } of store.list({ prefix: 'welcome-pending/', paginate: true })) {
    for (const { key } of blobs) {
      const id = key.slice('welcome-pending/'.length);
      if (await store.get(`welcome-done/${id}`)) {
        await store.delete(key);
        continue;
      }
      const job = await store.getWithMetadata(key, { type: 'json' });
      if (!job?.data) continue;
      // Claim before sending, preventing two concurrent workers sending the same email.
      const claim = await store.set(`welcome-claimed/${id}`, 'claimed', { onlyIfNew: true });
      if (!claim.modified) continue;
      try {
        const message = welcomeEmail({
          firstName: job.data.firstName, firstSessionDate: job.data.firstSessionDate,
          meetUrl,
        });
        await sendOperationalEmail({ apiKey, to: job.data.email, message, fetcher });
        await store.set(`welcome-done/${id}`, 'accepted', { onlyIfNew: true });
        await store.delete(key);
      } catch (error) {
        // Do not log email, name, private URL or provider response bodies.
        report('Operational welcome requires manual reconciliation', id, error?.name ?? 'error');
      }
    }
  }
}
