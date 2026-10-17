import { test } from 'node:test';
import assert from 'node:assert/strict';
import edge from '../netlify/edge-functions/registration.js';
import { availableStarts, sessionDates, validateRegistration } from '../session-dates.mjs';
const cases = [
 ['weekday', '2026-10-17T12:00:00Z', ['2026-10-19','2026-10-26']],
 ['BST Monday 18:29', '2026-10-19T17:29:59Z', ['2026-10-19','2026-10-26']],
 ['BST Monday 18:30', '2026-10-19T17:30:00Z', ['2026-10-26','2026-11-02']],
 ['GMT Monday 18:29', '2026-10-26T18:29:59Z', ['2026-10-26','2026-11-02']],
 ['GMT Monday 18:30', '2026-10-26T18:30:00Z', ['2026-11-02','2026-11-09']],
 ['BST begins Sunday', '2026-03-29T00:59:59Z', ['2026-03-30','2026-04-06']],
 ['BST begins after clock change', '2026-03-29T01:00:00Z', ['2026-03-30','2026-04-06']],
 ['year boundary', '2026-12-31T23:30:00Z', ['2027-01-04','2027-01-11']],
];
for (const [name, instant, expected] of cases) test(name, () => assert.deepEqual(availableStarts(new Date(instant)),expected));
test('four calendar Mondays across GMT change',()=>assert.deepEqual(sessionDates('2026-10-19'),['2026-10-19','2026-10-26','2026-11-02','2026-11-09']));
const data = start => new URLSearchParams({'form-name':'focus-hour-registration',name:'Test',email:'test@example.com',goal:'Learn',consent:'yes','bot-field':'','first-session-date':start});
test('server rejects stale, malformed and unoffered dates, accepts current options',()=>{
 const now=new Date('2026-10-19T17:30:00Z');
 for(const date of ['2026-10-19','2026-10-27','2026-11-09','invalid'])assert(validateRegistration(data(date),now));
 for(const date of ['2026-10-26','2026-11-02'])assert.equal(validateRegistration(data(date),now),null);
 const spam=data('2026-10-26');spam.set('bot-field','spam');assert(validateRegistration(spam,now));
 const consent=data('2026-10-26');consent.delete('consent');assert(validateRegistration(consent,now));
});
const post = d => new Request('https://example.netlify.app/',{method:'POST',body:d});
test('edge blocks invalid direct POST before Netlify Forms',async()=>{
 let called=false;const response=await edge(post(data('2000-01-03')),{next:()=>{called=true;return new Response('ok')}});
 assert.equal(response.status,400);assert.equal(called,false);
});
test('edge acknowledges only after Forms accepts, and reports downstream failure',async()=>{
 const start=availableStarts()[0];let called=0;
 let response=await edge(post(data(start)),{next:()=>{called++;return new Response('ok')}});
 assert.equal((await response.json()).received,true);assert.equal(called,1);
 response=await edge(post(data(start)),{next:()=>new Response('failed',{status:500})});
 assert.equal(response.status,502);assert.equal((await response.json()).received,undefined);
});
test('dates endpoint uses server clock and disables caching',async()=>{
 const response=await edge(new Request('https://example.netlify.app/api/session-dates'),{});
 assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual((await response.json()).starts,availableStarts());
});
test('duplicate dates cannot validate one value and store another',()=>{
 const d=data('2026-10-26');d.append('first-session-date','2026-10-19');
 assert(validateRegistration(d,new Date('2026-10-19T17:30:00Z')));
});
test('alternate native Forms endpoint is protected too',async()=>{
 let called=false;
 const request=new Request('https://example.netlify.app/thanks.html',{method:'POST',body:data('2000-01-03')});
 assert.equal((await edge(request,{next:()=>{called=true;return new Response('ok')}})).status,400);
 assert.equal(called,false);
});
