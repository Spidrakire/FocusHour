import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMondays, trialIncludes, eligibleForReminder, reminderDue, londonSessionDate,
  welcomeEmail, reminderEmail, sendOperationalEmail,
} from '../netlify/operational-emails.mjs';

const meetUrl = 'https://meet.google.com/abc-defg-hij';
test('trial covers four consecutive Mondays, not four attended sessions', () => {
  assert.deepEqual([0,1,2,3,4].map(i => addMondays('2026-11-16', i)),
    ['2026-11-16','2026-11-23','2026-11-30','2026-12-07','2026-12-14']);
  assert.equal(trialIncludes('2026-11-16', '2026-12-07'), true);
  assert.equal(trialIncludes('2026-11-16', '2026-12-14'), false);
  assert.equal(trialIncludes('2026-11-17', '2026-11-23'), false);
});
test('reminders require booking and valid access, not marketing consent', () => {
  const member = { firstSessionDate: '2026-11-16', membershipStatus: 'FREE_TRIAL', marketingConsent: false };
  assert.equal(eligibleForReminder(member, '2026-11-23'), true);
  assert.equal(eligibleForReminder({ ...member, cancelled: true }, '2026-11-23'), false);
  assert.equal(eligibleForReminder(member, '2026-12-14'), false);
  assert.equal(eligibleForReminder({ ...member, membershipStatus: 'PAID' }, '2026-12-14'), false);
  assert.equal(eligibleForReminder({ ...member, membershipStatus: 'PAID', paymentVerified: true }, '2026-12-14'), true);
  assert.equal(eligibleForReminder({ ...member, membershipStatus: 'EXPIRED' }, '2026-11-23'), false);
});
test('9am London follows BST and GMT, and is Monday only', () => {
  for (const instant of ['2026-11-16T09:00:00Z', '2027-06-14T08:00:00Z']) {
    assert.equal(reminderDue(new Date(instant)), true);
    assert.match(londonSessionDate(new Date(instant)), /^20\d\d-\d\d-\d\d$/);
  }
  assert.equal(reminderDue(new Date('2027-06-14T09:00:00Z')), false);
  assert.equal(reminderDue(new Date('2026-11-17T09:00:00Z')), false);
});
test('welcome and reminder include private URL only in server-rendered email', () => {
  const welcome = welcomeEmail({ firstName: 'Ada', firstSessionDate: '2026-11-16', meetUrl });
  const reminder = reminderEmail({ firstName: 'Ada', sessionDate: '2026-11-16', meetUrl });
  assert.match(welcome.textContent, /Monday 16 November 2026/);
  assert.match(reminder.textContent, /6.30–7.45pm/);
  assert.ok(welcome.textContent.includes(meetUrl));
  assert.ok(reminder.textContent.includes(meetUrl));
  assert.throws(() => reminderEmail({ firstName: 'Ada', sessionDate: '2026-11-16', meetUrl: 'https://evil.example' }));
});
test('transactional transport sends with verified sender, regardless of marketing preference', async () => {
  let body;
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    body = JSON.parse(options.body);
    return new Response(null, { status: 201 });
  };
  assert.equal(await sendOperationalEmail({
    apiKey: 'test', to: 'ada@example.com',
    message: reminderEmail({ firstName: 'Ada', sessionDate: '2026-11-16', meetUrl }),
    fetcher,
  }), true);
  assert.equal(body.sender.email, 'hello@focushour.co.uk');
  assert.equal(body.to[0].email, 'ada@example.com');
});
