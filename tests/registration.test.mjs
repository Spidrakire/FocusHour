import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = (await readFile(new URL('../registration.js', import.meta.url), 'utf8')).replace(/^import .*\n/, '');

test('form explains essential emails and offers an unchecked optional marketing choice', () => {
 assert(html.includes("By registering, you'll receive essential emails about your Focus Hour sessions, including joining details and reminders. See our <a href=\"privacy.html\">privacy notice</a>."));
 assert(html.includes("I'd also like to receive occasional emails about Focus Hour news, events and offers."));
 const checkbox = html.match(/<input[^>]*id="marketing-consent"[^>]*>/)[0];
 assert(!/\b(required|checked)\b/.test(checkbox));
 assert(!/name="consent"/.test(html));
 assert(html.includes('name="MARKETING_CONSENT" value="false"'));
});

for (const checked of [false, true]) test(`browser submits marketing ${checked} and completes registration`, async () => {
 const handlers = {};
 const select = { value: '2026-11-02', disabled: true, replaceChildren() {} };
 const button = { type: 'submit', addEventListener() {} };
 const status = { hidden: true, textContent: '', setAttribute() {} };
 const form = {
  elements: { 'first-session-date': select },
  querySelector: selector => selector === '#marketing-consent' ? { checked } : selector === '.form-status' ? status : button,
  reportValidity: () => true,
  addEventListener: (name, callback) => { handlers[name] = callback; },
 };
 let submitted, redirected;
 runInNewContext(script, {
  document: { querySelector: () => form, addEventListener() {} },
  Option: function(text, value) { this.value = value; },
  FormData: function() { return new URLSearchParams({ 'form-name': 'focus-hour-registration', 'first-session-date': select.value, MARKETING_CONSENT: 'false' }); },
  URLSearchParams, setInterval() {}, formatDate: x => x, sessionDates: x => [x],
  sessionStorage: { setItem() {} },
  window: { location: { assign: path => { redirected = path; } } },
  fetch: async (url, options) => {
   if (url === '/api/session-dates') return { ok: true, json: async () => ({ starts: ['2026-11-02', '2026-11-09'] }) };
   submitted = new URLSearchParams(options.body);
   return { ok: true, json: async () => ({ received: true, start: select.value }) };
  },
 });
 await new Promise(resolve => setImmediate(resolve));
 await handlers.submit({ preventDefault() {} });
 assert.equal(submitted.get('MARKETING_CONSENT'), String(checked));
 assert.equal(submitted.getAll('MARKETING_CONSENT').length, 1);
 assert.equal(redirected, '/thanks.html');
});
