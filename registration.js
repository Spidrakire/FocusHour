import { formatDate, sessionDates } from './session-dates.mjs';
const form = document.querySelector('form[name="focus-hour-registration"]');
const button = form.querySelector('button[type="submit"]');
const select = form.elements['first-session-date'];
const status = form.querySelector('.form-status');
let submitting = false;
let refreshing = false;
function message(text, error = false) {
  status.hidden = false;
  status.setAttribute('role', error ? 'alert' : 'status');
  status.textContent = text;
}
function setDates(starts) {
  const previous = select.value;
  select.replaceChildren(...starts.map(iso => new Option(formatDate(iso), iso)));
  select.selectedIndex = -1;
  if (starts.includes(previous)) select.value = previous;
  select.disabled = false;
  button.type = 'submit';
  button.disabled = false;
  return !previous || starts.includes(previous);
}
async function refresh() {
  const response = await fetch('/api/session-dates', { cache: 'no-store' });
  if (!response.ok) throw new Error('Dates unavailable');
  const data = await response.json();
  if (!Array.isArray(data.starts) || data.starts.length !== 2 || !data.starts.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x))) throw new Error('Invalid dates');
  const valid = setDates(data.starts);
  return valid;
}
async function loadDates() {
  if (submitting || refreshing) return;
  refreshing = true;
  button.disabled = true;
  try {
    const valid = await refresh();
    if (!valid) message('That session has started. Please choose another Monday.', true);
    else if (button.type === 'submit' && status.textContent.includes('load the available dates')) {
      status.hidden = true;
      status.textContent = '';
    }
  } catch {
    button.type = 'button';
    button.disabled = false;
    select.disabled = true;
    message('We couldn’t load the available dates. Select Join Focus Hour to try again.', true);
  } finally { refreshing = false; }
}
button.addEventListener('click', event => {
  if (select.disabled) {
    event.preventDefault();
    loadDates();
  }
});
loadDates();
setInterval(loadDates, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadDates(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || refreshing || !form.reportValidity()) return;
  submitting = true;
  button.disabled = true;
  let confirmed = false;
  try {
    const chosen = select.value;
    await refresh(); // Authoritative server clock immediately before sending.
    button.disabled = true;
    if (select.value !== chosen) {
      message('That session is no longer available. Please choose another Monday.', true);
      return;
    }
    message('Sending your registration…');
    const response = await fetch('/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    });
    const result = await response.json();
    if (!response.ok || result.received !== true || result.start !== chosen) {
      if (Array.isArray(result.starts)) setDates(result.starts);
      message(result.error || 'We couldn’t send your registration. Please try again. Your details are still here.', true);
      return;
    }
    confirmed = true;
    const receipt = { start: chosen, dates: sessionDates(chosen) };
    sessionStorage.setItem('focus-hour-receipt', JSON.stringify(receipt));
    window.location.assign('/thanks.html');
  } catch {
    if (confirmed) {
      message('Your registration has been received. Your four Focus Hours: ' + sessionDates(select.value).map(formatDate).join('; ') + '. Your first session is ' + formatDate(select.value) + '. All sessions: 6.30–7.45pm UK time. Joining instructions will be sent by email before your first session.');
    } else message('We couldn’t confirm your registration. Please check your connection and try again. Your details are still here.', true);
  } finally {
    submitting = false;
    button.disabled = confirmed || select.disabled;
  }
});
