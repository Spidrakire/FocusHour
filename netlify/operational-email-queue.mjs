import { eligibleForReminder, reminderEmail, welcomeEmail, sendOperationalEmail } from './operational-emails.mjs';

// The queue contains personal data. Use a private Netlify Blobs store only.
// An accepted Brevo request may be repeated if execution stops before acknowledgement.
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const keyFor = (type, id) => `pending/${type}/${id}`;
export async function queueWelcome(store, registration) {
  const { id, email, firstName, firstSessionDate } = registration;
  if (!validId(id) || !email || !firstName || !firstSessionDate) throw new Error('Invalid welcome job');
  const doneKey = `done/welcome/${id}`;
  if (await store.get(doneKey)) return false;
  await store.setJSON(keyFor('welcome', id), {
    type: 'welcome', id, email, firstName, firstSessionDate,
    attempts: 0, nextAttempt: 0,
  }, { onlyIfNew: true });
  return true;
}
export async function queueReminder(store, registration, sessionDate) {
  if (!eligibleForReminder(registration, sessionDate) || !validId(registration.id)) return false;
  const id = `${sessionDate}_${registration.id}`;
  if (await store.get(`done/reminder/${id}`)) return false;
  await store.setJSON(keyFor('reminder', id), {
    type: 'reminder', id, email: registration.email,
    firstName: registration.firstName, sessionDate,
    attempts: 0, nextAttempt: 0,
  }, { onlyIfNew: true });
  return true;
}
export async function deliverQueuedEmails(store, { apiKey, meetUrl, now = Date.now, fetcher = fetch, report = console.error, getCurrentRegistration }) {
  if (!apiKey || !meetUrl) throw new Error('Operational email configuration missing');
  const started = now();
  for await (const { blobs } of store.list({ prefix: 'pending/', paginate: true })) {
    for (const { key } of blobs) {
      if (now() - started > 20_000) return;
      const entry = await store.getWithMetadata(key, { type: 'json' });
      if (!entry?.data || entry.data.nextAttempt > now() || entry.data.failed) continue;
      const job = entry.data;
      if (!['welcome', 'reminder'].includes(job.type) || !validId(job.id)) continue;
      const doneKey = `done/${job.type}/${job.id}`;
      if (await store.get(doneKey)) { await store.delete(key); continue; }
      if (job.type === 'reminder') {
        // Never send a queued reminder after a cancellation or expiry.
        // Without a verified membership lookup, fail closed rather than send.
        if (typeof getCurrentRegistration !== 'function') continue;
        const member = await getCurrentRegistration(job.email);
        if (!member || member.id !== job.id.slice(11) ||
            !eligibleForReminder(member, job.sessionDate)) {
          await store.delete(key);
          continue;
        }
      }
      const claim = await store.setJSON(key, { ...job, nextAttempt: now() + 60_000 }, { onlyIfMatch: entry.etag });
      if (!claim.modified) continue;
      try {
        const message = job.type === 'welcome'
          ? welcomeEmail({ firstName: job.firstName, firstSessionDate: job.firstSessionDate, meetUrl })
          : reminderEmail({ firstName: job.firstName, sessionDate: job.sessionDate, meetUrl });
        await sendOperationalEmail({ apiKey, to: job.email, message, fetcher });
        await store.set(doneKey, 'accepted', { onlyIfNew: true });
        await store.delete(key);
      } catch (error) {
        const attempts = job.attempts + 1;
        await store.setJSON(key, {
          ...job, attempts,
          failed: attempts >= 8,
          nextAttempt: now() + Math.min(3600, 30 * 2 ** (attempts - 1)) * 1000,
        }, { onlyIfMatch: claim.etag });
        // Never log personal data, meeting links, API credentials or provider response bodies.
        report('Operational email delivery deferred', job.type, attempts, error?.name ?? 'error');
      }
    }
  }
}
