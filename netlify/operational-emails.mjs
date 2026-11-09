// Pure operational-email rules. No email is sent by importing this module.
// Scheduled dispatch must only use verified, currently booked registrations.
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function mondayDate(value) {
  if (!datePattern.test(value ?? '')) return null;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1 ? null : date;
}
export function addMondays(value, weeks) {
  const date = mondayDate(value);
  if (!date || !Number.isInteger(weeks)) throw new Error('Invalid Monday');
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}
export function trialIncludes(firstMonday, sessionMonday) {
  if (!mondayDate(sessionMonday) || !mondayDate(firstMonday)) return false;
  return Array.from({ length: 4 }, (_, i) => addMondays(firstMonday, i)).includes(sessionMonday);
}
export function eligibleForReminder(registration, sessionMonday) {
  if (!registration || registration.cancelled || registration.booked !== true) return false;
  if (!mondayDate(sessionMonday)) return false;
  if (registration.membershipStatus === 'PAID') {
    // A verified payment alone does not prove that this particular Monday is booked.
    return registration.paymentVerified === true &&
      Array.isArray(registration.paidSessionDates) &&
      registration.paidSessionDates.includes(sessionMonday);
  }
  return registration.membershipStatus === 'FREE_TRIAL' &&
    trialIncludes(registration.firstSessionDate, sessionMonday);
}
export function londonParts(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}
export function reminderDue(now) {
  const p = londonParts(now);
  return p.weekday === 'Mon' && p.hour === '09' && p.minute === '00';
}
export function londonSessionDate(now) {
  const p = londonParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}
export function humanMonday(value) {
  const date = mondayDate(value);
  if (!date) throw new Error('Invalid session date');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date).replace(',', '');
}
export function welcomeEmail({ firstName, firstSessionDate, meetUrl }) {
  if (!firstName?.trim() || !mondayDate(firstSessionDate)) throw new Error('Invalid welcome details');
  validateMeetUrl(meetUrl);
  return {
    subject: 'Welcome to Focus Hour! Your first session is booked',
    textContent: `Hi ${firstName.trim()},

Welcome to Focus Hour! Your first session is ${humanMonday(firstSessionDate)}, 6.30–7.45pm UK time.

Join online: ${meetUrl}

6.30–6.40pm: Set your goal.
6.40–7.40pm: Work quietly alongside the group.
7.40–7.45pm: Share your progress.

Your first four consecutive Mondays are free. No payment details are required.

See you on Monday!
Focus Hour
focushour.co.uk`,
  };
}
export function reminderEmail({ firstName, sessionDate, meetUrl }) {
  if (!firstName?.trim() || !mondayDate(sessionDate)) throw new Error('Invalid reminder details');
  validateMeetUrl(meetUrl);
  return {
    subject: 'Your Focus Hour is tonight at 6.30pm',
    textContent: `Hi ${firstName.trim()},

Your Focus Hour is tonight, ${humanMonday(sessionDate)}, 6.30–7.45pm UK time.

Join online: ${meetUrl}

Bring one thing you'd like to make progress on.

6.30–6.40pm: Set your goal.
6.40–7.40pm: Focus quietly.
7.40–7.45pm: Share your progress.

See you this evening!
Focus Hour
focushour.co.uk`,
  };
}
function validateMeetUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(value)) {
    throw new Error('Missing or invalid private meeting URL');
  }
}
// Call only from a server-side verified-registration workflow, never from browser code.
export async function sendOperationalEmail({ apiKey, to, message, fetcher = fetch }) {
  if (!apiKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to ?? '')) throw new Error('Invalid delivery configuration');
  const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Focus Hour', email: 'hello@focushour.co.uk' },
      to: [{ email: to }],
      subject: message.subject,
      textContent: message.textContent,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Operational email delivery failed (HTTP ${response.status})`);
  return true;
}
