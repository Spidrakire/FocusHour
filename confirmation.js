import { formatDate, sessionDates } from './session-dates.mjs';
const target = document.querySelector('#confirmation');
try {
  const receipt = JSON.parse(sessionStorage.getItem('focus-hour-receipt'));
  if (!receipt || !/^\d{4}-\d{2}-\d{2}$/.test(receipt.start)) throw new Error('No receipt');
  document.querySelector('h1').textContent = 'Your registration has been received.';
  const first = document.createElement('p');
  first.textContent = 'Your first Focus Hour: ' + formatDate(receipt.start) + '.';
  const list = document.createElement('ul');
  for (const date of sessionDates(receipt.start)) {
    const item = document.createElement('li'); item.textContent = formatDate(date); list.append(item);
  }
  const details = document.createElement('p');
  details.textContent = 'All sessions: 6.30–7.45pm UK time. Joining instructions will be sent by email before your first session.';
  target.replaceChildren(first, list, details);
} catch {
  document.querySelector('h1').textContent = 'Focus Hour registration';
  target.textContent = 'No confirmed registration is available in this browser. Please return to the registration form if you haven’t registered yet.';
}
