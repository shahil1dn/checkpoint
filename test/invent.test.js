// Plan row S9: a traveller invented during the shift. The code picks his
// truth, the model writes him, and nothing the model writes is trusted until
// the code has checked it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as R from '../src/rules.js';
import { LATE_ARRIVALS, getTraveller, registerTraveller } from '../src/travellers/index.js';
import { documentsFor } from '../src/records/index.js';
import { ARCHIVE } from '../src/records/archive.js';
import { runTool } from '../src/records/search.js';
import { assembleTraveller, buildInventMessages, pickBrief } from '../server/invent.js';
import { createApp } from '../server/app.js';

// A fixed "random", so each test sees the same brief.
const steady = (value) => () => value;
const WRITTEN = {
  name: 'Reginald Fishwick', from: 'Bristol', dateOfBirth: '12 November 1979', occupation: 'Marine biologist', employer: 'Oceanic Research Ltd',
  purposeOfVisit: 'Scientific expedition', sponsor: 'Antarctic Institute', luggage: 'Field equipment, 45 kg',
  coverStory: 'You are here to study penguin migration. Your sponsor paid for the trip.', secret: 'The cases hold 20 kg of krill to sell.',
  manner: 'You speak calmly and fidget when asked about the luggage.', bribeLine: 'A rare sticker for your collection?',
  manifestFreight: '3 insulated cases, 45 kg', manifestBookedBy: 'cash, at the dock', registryOccupation: 'fish trader', registryEmployer: 'none on file', registryVisits: '4 this year',
};
const raw = (changes = {}) => JSON.stringify({ ...WRITTEN, ...changes });

test('the code decides whether he is honest, never the model', () => {
  const liar = pickBrief(steady(0.9));
  const honest = pickBrief(steady(0.1));
  assert.equal(liar.honest, false);
  assert.equal(honest.honest, true);
  // The model's words can't flip it, even if it writes its own truth in.
  const made = assembleTraveller(raw({ secret: 'Nothing at all, completely above board.' }), liar, 'guest1');
  assert.equal(made.traveller.truth.honest, false);
  assert.match(buildInventMessages(liar)[0].content, /LYING/);
  assert.match(buildInventMessages(honest)[0].content, /HONEST/);
});

test('an invented traveller has everything a traveller file has, and the game\'s own documents', () => {
  const brief = pickBrief(steady(0.9));
  const { traveller, records } = assembleTraveller(raw(), brief, 'guest1', steady(0.5));
  assert.equal(traveller.id, 'guest1');
  assert.equal(traveller.name, 'Reginald Fishwick');
  assert.ok(traveller.prompt.includes(WRITTEN.secret) && traveller.prompt.includes('Only confess'));
  assert.equal(traveller.voice, brief.voice.id);
  assert.deepEqual(traveller.look, brief.look);
  assert.deepEqual(traveller.documents.map((d) => d.kind), ['passport', 'visa', 'ticket']);
  for (const doc of traveller.documents) assert.ok(Object.keys(doc.fields).length <= 6, doc.kind);
  // His ticket is for the ship the code picked, which has docked.
  assert.equal(traveller.documents[2].fields.Ship, brief.ship.name);
  assert.notEqual(brief.ship.arrived, 'not yet');
  assert.equal(records.passengers[0].ship, brief.ship.name);
  assert.equal(records.people[0].name, 'Fishwick, Reginald');
  // A bribe only when the code picked an item for it.
  assert.equal(traveller.bribe?.item ?? null, brief.bribeItem);
});

test('an honest one is told he has nothing to confess', () => {
  const { traveller } = assembleTraveller(raw(), pickBrief(steady(0.1)), 'guest1');
  assert.equal(traveller.truth.honest, true);
  assert.ok(traveller.prompt.includes('never confess'));
});

test('a broken, incomplete, over-long or verdict-carrying reply makes no traveller', () => {
  const brief = pickBrief(steady(0.9));
  assert.equal(assembleTraveller('not json', brief, 'guest1'), null);
  assert.equal(assembleTraveller('null', brief, 'guest1'), null);
  const { sponsor, ...missing } = WRITTEN;
  assert.equal(assembleTraveller(JSON.stringify(missing), brief, 'guest1'), null);
  assert.equal(assembleTraveller(raw({ name: '' }), brief, 'guest1'), null);
  assert.equal(assembleTraveller(raw({ name: '<b>Reg</b> 123' }), brief, 'guest1'), null);
  assert.equal(assembleTraveller(raw({ occupation: 'x'.repeat(200) }), brief, 'guest1'), null);
  assert.equal(assembleTraveller(raw({ registryOccupation: 'known liar' }), brief, 'guest1'), null);
  assert.equal(assembleTraveller(raw({ luggage: 'One suspicious crate' }), brief, 'guest1'), null);
});

test('markdown and line breaks are cleaned out of what he says and shows', () => {
  const { traveller } = assembleTraveller(raw({ luggage: '**Field**\nequipment, 45 kg' }), pickBrief(steady(0.9)), 'guest1');
  assert.equal(traveller.documents[2].fields.Luggage, 'Field equipment, 45 kg');
});

test('a late arrival joins the back of a running shift with a clean case and his own two minutes', () => {
  const { traveller } = assembleTraveller(raw(), pickBrief(steady(0.9)), 'guesttest');
  registerTraveller(traveller);
  const before = R.newShift();
  const joined = R.addTraveller(before, 'guesttest');
  assert.deepEqual(joined.queue, [...before.queue, 'guesttest']);
  assert.deepEqual(joined.cases.guesttest, { history: [], notes: [], lookups: [], stamp: null, bribe: null });
  assert.equal(R.timeLeftMs(joined), R.timeLeftMs(before) + R.TRAVELLER_MS);
  assert.deepEqual(documentsFor(getTraveller('guesttest')).map((d) => d.kind), ['passport', 'visa', 'ticket']);
  // Twice, or somebody unknown, changes nothing.
  assert.equal(R.addTraveller(joined, 'guesttest'), joined);
  assert.equal(R.addTraveller(before, 'nobody'), before);
});

test('nobody joins a finished shift, and Play again starts without the late arrivals', () => {
  const { traveller } = assembleTraveller(raw(), pickBrief(steady(0.9)), 'guesttest');
  registerTraveller(traveller);
  let shift = R.newShift();
  for (const id of [...LATE_ARRIVALS, 'guesttest']) shift = R.addTraveller(shift, id);
  assert.deepEqual(R.restartShift(shift).queue, R.newShift().queue);
  while (shift.phase === 'playing') shift = R.stamp(shift, 'through').shift;
  assert.equal(R.addTraveller(shift, 'guesttest'), shift);
  // He is scored like anyone, by the truth the code picked.
  assert.equal(R.shiftReport(shift).rows.find((r) => r.id === 'guesttest').correct, false);
});

// ---- The server route ----

async function serve(options) {
  const server = http.createServer(await createApp({ log: () => {}, ...options }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('POST /api/invent registers him, files his records, and he can then be questioned', async () => {
  const asked = [];
  const app = await serve({
    liveAvailable: true,
    random: steady(0.9),
    invent: async ({ brief }) => ({ raw: raw({ name: 'Greta Icefloe' }), model: 'mistral-large-4', brief }),
    ask: async ({ traveller }) => { asked.push(traveller.name); return JSON.stringify({ reply: 'Just visiting.', mood: 'neutral', cracked: false }); },
    speak: async () => 'bXAz',
    takeNotes: null,
  });
  try {
    const res = await fetch(`${app.base}/api/invent`, { method: 'POST' });
    assert.equal(res.status, 200);
    const { traveller, model } = await res.json();
    assert.equal(model, 'mistral-large-4');
    assert.equal(traveller.name, 'Greta Icefloe');
    assert.equal(getTraveller(traveller.id).name, 'Greta Icefloe');
    assert.ok(ARCHIVE.passengers.some((p) => p.name === 'Greta Icefloe'));
    assert.equal(runTool('search_passenger_lists', { name: 'Greta Icefloe' }).result.matches[0].name, 'Greta Icefloe');
    const reply = await fetch(`${app.base}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 1, travellerId: traveller.id, history: [], question: 'Why are you here?', notes: [] }) });
    assert.equal(reply.status, 200);
    assert.deepEqual(asked, ['Greta Icefloe']);
    assert.equal((await fetch(`${app.base}/api/invent`)).status, 405);
  } finally {
    await app.close();
  }
});

test('a reply that fails the check is asked for once more, then given up on; offline there is nobody to invent', async () => {
  let calls = 0;
  const bad = await serve({ liveAvailable: true, invent: async () => { calls += 1; return { raw: 'nonsense', model: 'mistral-large-4' }; } });
  const failing = await serve({ liveAvailable: true, invent: async () => { throw new Error('down'); } });
  const offline = await serve({ liveAvailable: false });
  try {
    const res = await fetch(`${bad.base}/api/invent`, { method: 'POST' });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'badTraveller');
    assert.equal(calls, 2);
    assert.equal((await fetch(`${failing.base}/api/invent`, { method: 'POST' })).status, 502);
    assert.equal((await fetch(`${offline.base}/api/invent`, { method: 'POST' })).status, 503);
  } finally {
    await Promise.all([bad.close(), failing.close(), offline.close()]);
  }
});
