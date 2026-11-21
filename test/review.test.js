// The shift review (Shahil 17:10): the code scores and rates the shift from the
// server's own truth; Mistral only writes the words, and the code writes them
// when Mistral can't (ADR-2).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { cannedReview, parseReview, rateShift, shiftReport, validateReviewRequest } from '../src/rules.js';
import { getTraveller, QUEUE } from '../src/travellers/index.js';

test('the rating comes from the score and the bribe record, at exact boundaries', () => {
  assert.deepEqual(rateShift({ correct: 3, total: 3, record: 'clean' }), { title: 'Chief Inspector', stars: 3 });
  assert.deepEqual(rateShift({ correct: 2, total: 3, record: 'clean' }), { title: 'Senior Inspector', stars: 2 });
  assert.deepEqual(rateShift({ correct: 1, total: 3, record: 'clean' }), { title: 'Inspector', stars: 1 });
  assert.deepEqual(rateShift({ correct: 0, total: 3, record: 'clean' }), { title: 'Trainee', stars: 0 });
  assert.deepEqual(rateShift({ correct: 3, total: 3, record: 'corrupt' }), { title: 'CORRUPT', stars: 0 });
  assert.equal(rateShift({ correct: 0, total: 0, record: 'clean' }).title, 'Trainee');
});

const right = (id) => (getTraveller(id).truth.honest ? 'through' : 'away');
const wrong = (id) => (getTraveller(id).truth.honest ? 'away' : 'through');

test('the review request carries only stamps and bribes; anything else is refused', () => {
  const ok = validateReviewRequest({ queue: QUEUE, stamps: Object.fromEntries(QUEUE.map((id) => [id, right(id)])), bribesTaken: [] });
  assert.equal(ok.ok, true);
  assert.equal(shiftReport(ok.value).correct, QUEUE.length);
  for (const bad of [
    null,
    { queue: ['nobody'], stamps: {} },
    { queue: [], stamps: {} },
    { queue: ['max', 'max'], stamps: {} },
    { queue: ['max'], stamps: { max: 'shot' } },
    { queue: ['max'], stamps: [] },
    { queue: ['max'], stamps: {}, bribesTaken: ['rupert'] },
  ]) assert.equal(validateReviewRequest(bad).ok, false, JSON.stringify(bad));
});

test("Mistral's words are kept only for this shift's travellers, cut to length, markdown gone", () => {
  const report = shiftReport(validateReviewRequest({ queue: ['max'], stamps: { max: 'away' } }).value);
  const words = parseReview(JSON.stringify({ headline: '**Fine work**', per_traveller: [{ name: 'Max Tokens', comment: 'x'.repeat(400) }, { name: 'Stranger', comment: 'hi' }], tip: 'Look closer.' }), report);
  assert.equal(words.headline, 'Fine work');
  assert.equal(words.comments.length, 1);
  assert.equal([...words.comments[0].comment].length, 160);
  assert.equal(parseReview('not json', report), null);
  assert.equal(parseReview(JSON.stringify({ headline: '', per_traveller: [] }), report), null);
});

test('the canned review names the bribe and each call', () => {
  const report = shiftReport(validateReviewRequest({ queue: ['max', 'rupert'], stamps: { max: 'through', rupert: right('rupert') }, bribesTaken: ['max'] }).value);
  const words = cannedReview(report, rateShift(report));
  assert.match(words.headline, /bribe/);
  assert.equal(words.comments[0].comment, 'Let through for a bribe.');
});

let live;
let reviews = [];
let nextWords;
async function serve(options) {
  const server = http.createServer(await createApp(options));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
before(async () => {
  live = await serve({
    liveAvailable: true,
    ask: async () => '{}',
    review: async (req) => {
      reviews.push(req);
      if (nextWords instanceof Error) throw nextWords;
      return nextWords;
    },
  });
});
after(() => live.close());
const postReview = (body) => fetch(`${live.base}/api/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the server scores from its own truth, not anything the page claims', async () => {
  reviews = [];
  nextWords = JSON.stringify({ headline: 'A shift.', per_traveller: [], tip: 'Stamp better.' });
  const stamps = Object.fromEntries(QUEUE.map((id) => [id, wrong(id)]));
  // The page lies that everyone was honest and that it scored 3 of 3.
  const res = await postReview({ queue: QUEUE, stamps, bribesTaken: [], correct: 3, rows: QUEUE.map((id) => ({ id, honest: true, correct: true })) });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.correct, 0);
  assert.deepEqual(body.rating, { title: 'Trainee', stars: 0 });
  assert.equal(body.by, 'mistral');
  assert.equal(body.review.headline, 'A shift.');
  // Mistral is told the code's score and rating to write about, nothing to decide.
  assert.equal(reviews[0].rating.title, 'Trainee');
  assert.equal(reviews[0].report.correct, 0);
});

test('a failed or unusable review call falls back to the code\'s own words', async () => {
  for (const words of [new Error('Mistral down'), 'not json']) {
    nextWords = words;
    const body = await (await postReview({ queue: ['max'], stamps: { max: right('max') } })).json();
    assert.equal(body.by, 'code');
    assert.equal(body.correct, 1);
    assert.ok(body.review.headline.length > 0);
  }
});

test('a bad review request is refused, and review takes POST only', async () => {
  assert.equal((await postReview({ queue: ['nobody'], stamps: {} })).status, 400);
  assert.equal((await fetch(`${live.base}/api/review`)).status, 405);
});
