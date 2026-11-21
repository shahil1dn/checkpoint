// POST /api/lookup (ADR-12): the server refuses any line the inspector never
// gathered before anything runs, counts lookups, and streams the steps and a
// report with no verdict in it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';

const lookups = [];
let nextReport = 'Company register: Frontier Horizon Labs, AI research lab.';
const REPLY = 'Frontier who? Never heard of them.';

async function serve(options) {
  const server = http.createServer(await createApp(options));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

let live;
let offline;
before(async () => {
  live = await serve({
    liveAvailable: true,
    ask: async () => JSON.stringify({ reply: REPLY, mood: 'frustrated', cracked: false, bribe: false }),
    speak: async () => 'QUJD',
    lookup: async (req) => {
      lookups.push(req);
      req.onStep({ tool: 'find_company', step: 'searched the company register: 1 exact match' });
      if (nextReport instanceof Error) throw nextReport;
      return nextReport;
    },
  });
  const never = async () => { throw new Error('offline: Mistral is never called'); };
  offline = await serve({ liveAvailable: false, ask: never, lookup: never });
});
after(() => { live.close(); offline.close(); });

const post = (base, path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function events(res) {
  return (await res.text()).trim().split('\n').map((line) => JSON.parse(line));
}

const SPONSOR = 'Sponsor: Frontier Horizon Labs';   // on his entry visa

test('a line from his visa is looked up: the steps stream, then the report', async () => {
  lookups.length = 0;
  nextReport = '- Company register: Frontier Horizon Labs, AI research lab.';
  const res = await post(live.base, '/api/lookup', { travellerId: 'max', line: SPONSOR, earlier: [] });
  assert.equal(res.status, 200);
  const [step, done] = await events(res);
  assert.equal(step.step, 'searched the company register: 1 exact match');
  assert.deepEqual(done.answer, ['Company register: Frontier Horizon Labs, AI research lab.']);
  assert.ok(Number.isInteger(done.ms));
  // The terminal gets the line, where it came from and the name on his
  // papers: never the traveller.
  assert.deepEqual(Object.keys(lookups[0]).sort(), ['line', 'name', 'onStep', 'source']);
  assert.equal(lookups[0].source, 'visa');
  assert.equal(lookups[0].name, 'Maximilian Tokens');
});

test('a line from his ticket is looked up as a ticket line', async () => {
  lookups.length = 0;
  const res = await post(live.base, '/api/lookup', { travellerId: 'max', line: 'Ship: Seine Star' });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(lookups[0].source, 'ticket');
});

test('a made-up line, or the inspector\'s own question, is refused before anything runs', async () => {
  lookups.length = 0;
  // His old papers' sponsor line is no longer in his folder, so it is refused too.
  for (const line of ['Is he a spy for a rival lab?', 'Sponsor: Mistral AI', 'Ticket sponsored by: Frontier Horizon Labs']) {
    const res = await post(live.base, '/api/lookup', { travellerId: 'max', line });
    assert.equal(res.status, 403, line);
    assert.deepEqual(await res.json(), { error: 'notGathered' });
  }
  const asked = 'Who paid for your ticket?';
  await (await post(live.base, '/api/ask', { travellerId: 'max', question: asked, history: [] })).json();
  const res = await post(live.base, '/api/lookup', { travellerId: 'max', line: asked });
  assert.equal(res.status, 403);
  assert.equal(lookups.length, 0);
});

test('what he really said becomes lookable once he has said it, and only for him', async () => {
  lookups.length = 0;
  const before = await post(live.base, '/api/lookup', { travellerId: 'colin', line: REPLY });
  assert.equal(before.status, 403);
  await (await post(live.base, '/api/ask', { travellerId: 'max', question: 'Who paid?', history: [] })).json();
  const res = await post(live.base, '/api/lookup', { travellerId: 'max', line: REPLY });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(lookups[0].source, 'said');
  assert.equal((await post(live.base, '/api/lookup', { travellerId: 'colin', line: REPLY })).status, 403);
});

test('a 4th lookup is refused before anything runs', async () => {
  lookups.length = 0;
  const res = await post(live.base, '/api/lookup', { travellerId: 'max', line: SPONSOR, earlier: ['Name: Max Tokens', 'From: Paris (he says)', 'Ship: Seine Star'] });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'outOfLookups' });
  assert.equal(lookups.length, 0);
});

test('report lines with a verdict word never reach the page', async () => {
  nextReport = 'Company register: Frontier Horizon Labs, AI research lab.\nSo he is probably lying.';
  let [, done] = await events(await post(live.base, '/api/lookup', { travellerId: 'max', line: SPONSOR }));
  assert.deepEqual(done.answer, ['Company register: Frontier Horizon Labs, AI research lab.']);
  nextReport = 'He is guilty.';
  [, done] = await events(await post(live.base, '/api/lookup', { travellerId: 'max', line: SPONSOR }));
  assert.deepEqual(done, { error: 'noReport' });
});

test('a failed lookup reports the failure, so the page does not count it', async () => {
  nextReport = new Error('Mistral down');
  const [, done] = await events(await post(live.base, '/api/lookup', { travellerId: 'max', line: SPONSOR }));
  assert.deepEqual(done, { error: 'callFailed' });
});

test('offline, the code searches the records itself: Max\'s ship is the delayed Paris ship', async () => {
  const res = await post(offline.base, '/api/lookup', { travellerId: 'max', line: 'Ship: Seine Star' });
  assert.equal(res.status, 200);
  const all = await events(res);
  assert.match(all[0].step, /Seine Star list/);
  assert.match(all.at(-1).answer.join(' '), /Seine Star from Paris.*delayed/);
});

test("offline, a canned answer counts as said, and a made-up one doesn't", async () => {
  const canned = "Cheese. Forty kilos. The French wouldn't buy a crumb, so it's going to the hackathon lunch.";
  assert.equal((await post(offline.base, '/api/lookup', { travellerId: 'colin', line: canned })).status, 200);
  assert.equal((await post(offline.base, '/api/lookup', { travellerId: 'colin', line: 'I am a spy.' })).status, 403);
});

test('lookup takes POST only', async () => {
  assert.equal((await fetch(`${live.base}/api/lookup`)).status, 405);
});

test('a traveller with no documents in his records hands over his papers, and those lines are looked up', async () => {
  lookups.length = 0;
  const res = await post(live.base, '/api/lookup', { travellerId: 'colin', line: 'Arriving from: The Paris Cheese Fair' });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(lookups[0].source, 'papers');
  assert.equal(lookups[0].name, 'Colin Stilton');
});
