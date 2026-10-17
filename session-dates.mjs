const london = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function availableStarts(now = new Date()) {
  const p = Object.fromEntries(london.formatToParts(now).map(x => [x.type, x.value]));
  const today = `${p.year}-${p.month}-${p.day}`;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  let days = (8 - weekday) % 7;
  if (days === 0 && Number(p.hour) * 60 + Number(p.minute) >= 18 * 60 + 30) days = 7;
  const first = addDays(today, days);
  return [first, addDays(first, 7)];
}
export function sessionDates(start) {
  return [0, 7, 14, 21].map(days => addDays(start, days));
}
export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`)).replace(',', '');
}
export function validateRegistration(data, now = new Date()) {
  for (const field of ['form-name', 'name', 'email', 'goal', 'consent', 'first-session-date', 'bot-field']) {
    if (data.getAll(field).length > 1) return 'Invalid registration.';
  }
  if (data.get('bot-field')) return 'Invalid registration.';
  if (!String(data.get('name') || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get('email') || '')) ||
      !String(data.get('goal') || '').trim() || data.get('consent') !== 'yes') return 'Please complete the required fields and consent.';
  if (!availableStarts(now).includes(data.get('first-session-date'))) return 'Please choose an available first-session date.';
  return null;
}
