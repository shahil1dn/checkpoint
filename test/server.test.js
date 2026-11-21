import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { getTraveller } from '../src/travellers/index.js';
import { FALLBACK_LINE } from '../src/rules.js';

const FAKE_KEY = 'test-key-must-not-leak';
let server;
let base;
const calls = [];
let nextRaw;
const heard = [];
let nextTranscript = 'Who paid for your ticket?';
const spoken = [];
let speechFails = false;
const noted = [];
const NOTE = 'Says he came for the hackathon.';
let nextNotes = JSON.stringify({ notes: [NOTE] });

before(async () => {
  process.env.MISTRAL_API_KEY = FAKE_KEY;
  const handle = await createApp({
    liveAvailable: true,
    ask: async (req) => {
      calls.push(req);
      const next = Array.isArray(nextRaw) ? nextRaw.shift() : nextRaw;
      if (next instanceof Error) throw next;
      return next;
    },
    hear: async (req) => {
      heard.push(req);
      return nextTranscript;
    },
    speak: async (req) => {
      spoken.push(req);
      if (speechFails) throw new Error('speech down');
      return 'QUJD';
    },
    takeNotes: async (req) => {
      noted.push(req);
      if (nextNotes instanceof Error) throw nextNotes;
      return nextNotes;
    },
  });
  server = http.createServer(handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (body) => fetch(`${base}/api/ask`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const valid = { travellerId: 'max', question: 'Why are you here?', history: [] };
const pastExchange = { question: 'Hello?', reply: 'Bonjour, inspector!', mood: 'happy' };
const GOOD_RAW = '{"reply":"For the hackathon, of course!","mood":"confident","cracked":false}';

test('a good question reaches Mistral and the checked, spoken reply comes back', async () => {
  calls.length = 0;
  spoken.length = 0;
  nextRaw = GOOD_RAW;
  const res = await post(valid);
  assert.equal(res.status, 200);
  const { timings, ...answer } = await res.json();
  assert.deepEqual(answer, { reply: 'For the hackathon, of course!', mood: 'confident', cracked: false, audio: 'QUJD', notes: [NOTE] });
  // Real timings for the inspector's computer: whole milliseconds for each call.
  for (const name of ['answerMs', 'speechMs', 'notesMs']) assert.ok(Number.isInteger(timings[name]) && timings[name] >= 0, name);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].traveller.id, 'max');
  assert.equal(calls[0].question, 'Why are you here?');
  assert.deepEqual(spoken, [{ text: 'For the hackathon, of course!', voiceId: getTraveller('max').voices.confident }]);
});

test('the voice follows the cleaned mood, and markdown never reaches speech', async () => {
  spoken.length = 0;
  nextRaw = JSON.stringify({ reply: '**Non!** I am _innocent_', mood: 'furious', cracked: false });
  const body = await (await post(valid)).json();
  assert.equal(body.mood, 'neutral');
  assert.deepEqual(spoken, [{ text: 'Non! I am innocent', voiceId: getTraveller('max').voices.neutral }]);
});

test('when speech fails the reply still comes back, silent', async () => {
  speechFails = true;
  nextRaw = GOOD_RAW;
  const res = await post(valid);
  speechFails = false;
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reply, 'For the hackathon, of course!');
  assert.equal(body.audio, null);
});

// A4: every one of these must be refused with Mistral called 0 times.
const badRequests = {
  'broken JSON': '{nope',
  'a body over 16 KB': { ...valid, pad: 'x'.repeat(17 * 1024) },
  'an empty question': { ...valid, question: '   ' },
  'a 301-character question': { ...valid, question: 'a'.repeat(301) },
  'an unknown traveller': { ...valid, travellerId: 'nobody' },
  'a 6th question (history of 5)': { ...valid, history: Array(5).fill(pastExchange) },
  'a history item that is not an exchange': { ...valid, history: ['hi'] },
  'a past reply over 300 characters': { ...valid, history: [{ ...pastExchange, reply: 'a'.repeat(301) }] },
};
for (const [name, body] of Object.entries(badRequests)) {
  test(`${name} is refused before Mistral is called`, async () => {
    calls.length = 0;
    nextRaw = GOOD_RAW;
    const res = await post(body);
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });
}

test('a 300-character question with 4 past exchanges is still allowed', async () => {
  calls.length = 0;
  nextRaw = GOOD_RAW;
  const res = await post({ ...valid, question: 'a'.repeat(300), history: Array(4).fill(pastExchange) });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

test('a failed Mistral call returns 502 without detail', async () => {
  nextRaw = new Error(`secret detail ${FAKE_KEY}`);
  const res = await post(valid);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'callFailed' });
});

// ---- The scratchpad ----

// A11, at the call site: the note-taker is handed the papers and the
// conversation, and nothing else of the traveller.
test('the note-taker gets only the papers and the conversation', async () => {
  noted.length = 0;
  nextRaw = GOOD_RAW;
  await post({ ...valid, history: [pastExchange] });
  assert.equal(noted.length, 1);
  assert.deepEqual(Object.keys(noted[0]).sort(), ['earlierNotes', 'exchanges', 'papers']);
  assert.deepEqual(noted[0].papers, getTraveller('max').papers);
  assert.deepEqual(noted[0].exchanges.map((e) => e.question), ['Hello?', 'Why are you here?']);
  assert.ok(!JSON.stringify(noted[0]).includes(getTraveller('max').truth.secret));
});

test('notes with a verdict are dropped, and the answer still arrives', async () => {
  nextRaw = GOOD_RAW;
  nextNotes = JSON.stringify({ notes: ['He is lying about the sponsor.', 'Offered a sticker.'] });
  const body = await (await post(valid)).json();
  assert.deepEqual(body.notes, ['Offered a sticker.']);
  nextNotes = new Error('notes down');
  const res = await post(valid);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).notes, []);
  nextNotes = JSON.stringify({ notes: [NOTE] });
});

test('notes already on the scratchpad go to the note-taker, and an exact repeat is dropped', async () => {
  noted.length = 0;
  nextRaw = GOOD_RAW;
  nextNotes = JSON.stringify({ notes: ['offered a sticker.', 'Says Paris.'] });
  const body = await (await post({ ...valid, notes: ['Offered a sticker.'] })).json();
  assert.deepEqual(noted[0].earlierNotes, ['Offered a sticker.']);
  assert.deepEqual(body.notes, ['Says Paris.']);
  nextNotes = JSON.stringify({ notes: [NOTE] });
});

test('earlier notes that break the note limits are refused before Mistral is called', async () => {
  calls.length = 0;
  for (const notes of [['a'.repeat(121)], Array(11).fill('ok'), [42], 'one']) {
    assert.equal((await post({ ...valid, notes })).status, 400);
  }
  assert.equal(calls.length, 0);
});

// ---- C3 and C5: the code owns confessions; one retry, then "say that again" ----

const raw = (reply, cracked = false) => JSON.stringify({ reply, mood: 'sad', cracked });
const maxAt = (questionNumber) => ({ ...valid, history: Array(questionNumber - 1).fill(pastExchange) });

test('a broken reply is retried once, and the retry is what the player gets', async () => {
  calls.length = 0;
  nextRaw = ['Sure! Here is my answer', raw('Second try.')];
  const body = await (await post(valid)).json();
  assert.equal(calls.length, 2);
  assert.equal(body.reply, 'Second try.');
  assert.equal(body.fallback, undefined);
});

test('two broken replies become an in-character "say that again", spoken', async () => {
  calls.length = 0;
  spoken.length = 0;
  nextRaw = ['not json', '{"mood":"sad"}'];
  const res = await post(valid);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(calls.length, 2);
  assert.deepEqual({ reply: body.reply, fallback: body.fallback, cracked: body.cracked, notes: body.notes }, { reply: FALLBACK_LINE, fallback: true, cracked: false, notes: [] });
  assert.equal(spoken[0].text, FALLBACK_LINE);
});

test('a liar confessing at question 2 is refused and asked again with a nudge', async () => {
  calls.length = 0;
  nextRaw = [raw('Fine, I am a spy!', true), raw('Spy? Me? Never.')];
  const body = await (await post(maxAt(2))).json();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].nudge, undefined);
  assert.match(calls[1].nudge, /too early to confess/);
  assert.deepEqual([body.reply, body.cracked], ['Spy? Me? Never.', false]);
});

test('a liar who keeps confessing before question 3 gets the fallback, not a confession', async () => {
  nextRaw = [raw('I confess!', true), raw('I confess again!', true)];
  const body = await (await post(maxAt(1))).json();
  assert.equal(body.fallback, true);
  assert.equal(body.cracked, false);
});

test('a liar confessing from question 3 on is accepted at once', async () => {
  calls.length = 0;
  nextRaw = [raw('Fine. Frontier Horizon sent me.', true)];
  const body = await (await post(maxAt(3))).json();
  assert.equal(calls.length, 1);
  assert.equal(body.cracked, true);
});

test("an honest traveller's confession is ignored", async () => {
  nextRaw = [raw('Fine, I admit it, it is cheese.', true)];
  const body = await (await post({ ...valid, travellerId: 'colin', history: Array(3).fill(pastExchange) })).json();
  assert.equal(body.cracked, false);
  assert.equal(body.fallback, undefined);
});

const postClip = (body, type = 'audio/webm;codecs=opus') => fetch(`${base}/api/hear`, {
  method: 'POST', headers: { 'content-type': type }, body,
});

test('a recorded clip is passed on as audio and its words come back', async () => {
  heard.length = 0;
  nextTranscript = '  Who paid   for_your ticket?  ';
  const res = await postClip(new Uint8Array([1, 2, 3]));
  assert.equal(res.status, 200);
  const { ms, ...transcript } = await res.json();
  assert.deepEqual(transcript, { text: 'Who paid for your ticket?' });
  assert.ok(Number.isInteger(ms) && ms >= 0);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].type, 'audio/webm');
  assert.equal(heard[0].audio.length, 3);
});

test('a transcript longer than a question is cut to the question limit', async () => {
  nextTranscript = 'a'.repeat(500);
  const { text } = await (await postClip(new Uint8Array([1]))).json();
  assert.equal(text.length, 300);
});

const badClips = {
  'an empty clip': [new Uint8Array(0)],
  'a clip over 1 MB': [new Uint8Array(1024 * 1024 + 1)],
  'a clip that is not audio': [new Uint8Array([1]), 'text/html'],
  'a clip with no type': [new Uint8Array([1]), ''],
};
for (const [name, [body, type]] of Object.entries(badClips)) {
  test(`${name} is refused before Mistral is called`, async () => {
    heard.length = 0;
    const res = await postClip(body, type).catch(() => null);
    if (res) assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
    assert.equal(heard.length, 0);
  });
}

test('only known files are served', async () => {
  for (const p of ['/', '/src/rules.js', '/src/travellers/index.js', '/src/travellers/colin.js', '/scenery.js', '/penguins/penguin.js', '/vendor/three/build/three.module.js', '/vendor/three/addons/controls/OrbitControls.js']) {
    assert.equal((await fetch(`${base}${p}`)).status, 200, p);
  }
  for (const p of ['/.env', '/src/../.env', '/server/mistral.js', '/package.json', '/%2e%2e/.env',
    '/node_modules/three/package.json', '/vendor/three/package.json', '/vendor/three/build/three.cjs', '/vendor/three/../../.env']) {
    assert.equal((await fetch(`${base}${p}`)).status, 404, p);
  }
});

// A6: with a key set, nothing the browser can fetch contains it.
test('the key never appears in any page file or API response', async () => {
  nextRaw = GOOD_RAW;
  const bodies = await Promise.all([
    fetch(`${base}/`), fetch(`${base}/app.js`), fetch(`${base}/src/travellers/index.js`), fetch(`${base}/src/travellers/max.js`),
    fetch(`${base}/src/rules.js`), fetch(`${base}/api/health`), post(valid), post('{nope'),
  ].map(async (p) => (await p).text()));
  for (const body of bodies) assert.ok(!body.includes(FAKE_KEY));
});

// The answer the page gets (and the computer screen reads) never carries a
// traveller's truth or prompt.
test('an answer never carries the traveller\'s secret or prompt', async () => {
  for (const id of ['max', 'colin']) {
    nextRaw = GOOD_RAW;
    const body = await (await post({ ...valid, travellerId: id })).text();
    const t = getTraveller(id);
    assert.ok(!body.includes(t.truth.secret), `${id}: secret`);
    assert.ok(!body.includes(t.prompt.slice(0, 60)), `${id}: prompt`);
    assert.doesNotMatch(body, /"truth"|"secret"|"prompt"|"honest"/);
  }
});

test('with no key the server says live is off and refuses to ask', async () => {
  const handle = await createApp({ liveAvailable: false, ask: null });
  const s = http.createServer(handle);
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${s.address().port}`;
  assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { live: false });
  const res = await fetch(`${url}/api/ask`, { method: 'POST', body: JSON.stringify(valid) });
  assert.equal(res.status, 503);
  s.close();
});
