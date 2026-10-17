import { availableStarts, sessionDates, validateRegistration } from '../../session-dates.mjs';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
export default async (request, context) => {
  const url = new URL(request.url);
  if (url.pathname === '/api/session-dates' && request.method === 'GET') {
    return json({ starts: availableStarts(), serverTime: new Date().toISOString() });
  }
  if (request.method !== 'POST') return context.next();
  // Protect every static Forms endpoint, including native posts to /thanks.html.
  let data;
  try { data = await request.clone().formData(); }
  catch { return json({ error: 'Invalid form submission.' }, 400); }
  if (data.get('form-name') !== 'focus-hour-registration') return context.next();
  const error = validateRegistration(data);
  if (error) return json({ error, starts: availableStarts() }, 400);
  const response = await context.next();
  if (response.status < 200 || response.status >= 400) {
    return json({ error: 'Registration could not be stored. Please try again.' }, 502);
  }
  // Only acknowledge after Netlify Forms has accepted the POST.
  return json({ received: true, start: data.get('first-session-date'), dates: sessionDates(data.get('first-session-date')) });
};
