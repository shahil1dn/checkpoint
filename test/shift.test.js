import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import { mockReply } from '../src/mockBrain.js';
import { getTraveller } from '../src/travellers/index.js';

// Asks one question and answers it with the mock brain, the way the page does.
function askAndAnswer(shift, text = 'Why are you here?') {
  const started = R.startQuestion(shift, text);
  assert.equal(started.error, undefined);
  const reply = R.parseReply(mockReply(started.request));
  return R.finishQuestion(started.shift, started.request.id, reply);
}

// A1
test('the 6th question to one traveller is refused and costs nothing', () => {
  let shift = R.newShift();
  for (let i = 0; i < 5; i += 1) shift = askAndAnswer(shift);
  assert.equal(R.questionsLeft(shift, 'max'), 0);
  const sixth = R.startQuestion(shift, 'One more?');
  assert.equal(sixth.error, 'outOfQuestions');
  assert.equal(sixth.shift, shift);
  assert.equal(sixth.shift.cases.max.history.length, 5);
  assert.equal(sixth.shift.pending, null);
});

// A2
test('stamping a liar through scores wrong, even though the model never cracked', () => {
  let shift = askAndAnswer(R.newShift());
  assert.equal(shift.cases.max.history[0].cracked, false);
  shift = R.stamp(shift, 'through').shift;
  shift = R.stamp(shift, 'through').shift;
  shift = R.stamp(shift, 'through').shift;
  const report = R.shiftReport(shift);
  assert.deepEqual(report.rows.map((r) => [r.id, r.stamp, r.honest, r.correct]), [
    ['max', 'through', false, false],
    ['rupert', 'through', true, true],
    ['pebble', 'through', false, false],
  ]);
  assert.equal(report.correct, 1);
});

test('a confession does not change the score either way', () => {
  let shift = R.newShift();
  const started = R.startQuestion(shift, 'Confess!');
  shift = R.finishQuestion(started.shift, started.request.id, { reply: 'Fine, I am a spy.', mood: 'sad', cracked: true });
  shift = R.stamp(shift, 'through').shift;
  assert.equal(R.shiftReport(shift).rows[0].correct, false);
});

// A3
test('the clock does not run while waiting for Mistral', () => {
  let shift = R.tick(R.newShift(), 1000);
  const started = R.startQuestion(shift, 'Why are you here?');
  shift = R.tick(started.shift, 10_000);
  shift = R.finishQuestion(shift, started.request.id, R.parseReply(mockReply(started.request)));
  assert.equal(shift.usedMs, 1000);
  assert.equal(R.tick(shift, 500).usedMs, 1500);
});

test('the clock also waits while speech is being turned into words', () => {
  let shift = R.setHearing(R.newShift(), true);
  shift = R.tick(shift, 5000);
  assert.equal(shift.usedMs, 0);
  assert.equal(R.tick(R.setHearing(shift, false), 5000).usedMs, 5000);
});

test('stamping is allowed before the first question, and the queue moves on', () => {
  // The first TURNED AWAY brings out his bribe; the second one lands.
  const { shift, error } = R.stamp(R.stamp(R.newShift(), 'away').shift, 'away');
  assert.equal(error, undefined);
  assert.equal(R.currentTravellerId(shift), 'rupert');
  const done = R.stamp(R.stamp(R.stamp(shift, 'through').shift, 'away').shift, 'away').shift;
  assert.equal(done.phase, 'over');
  assert.equal(done.endReason, 'queueEmpty');
  assert.equal(R.shiftReport(done).correct, 3);
  assert.equal(R.startQuestion(done, 'Hi').error, 'shiftOver');
  assert.equal(R.stamp(done, 'away').error, 'shiftOver');
});

test('a reply that arrives after the stamp is dropped', () => {
  const started = R.startQuestion(R.newShift(), 'Why?');
  const stamped = R.stamp(started.shift, 'away').shift;
  const after = R.finishQuestion(stamped, started.request.id, { reply: 'Late!', mood: 'sad', cracked: false });
  assert.equal(after, stamped);
  assert.equal(after.cases.max.history.length, 0);
});

test('only one question can be out at a time, and a failed one is not counted', () => {
  const first = R.startQuestion(R.newShift(), 'One?');
  assert.equal(R.startQuestion(first.shift, 'Two?').error, 'pending');
  const failed = R.finishQuestion(first.shift, first.request.id, null);
  assert.equal(failed.pending, null);
  assert.equal(R.questionsLeft(failed, 'max'), 5);
});

test("each answer's notes are kept on that traveller's scratchpad", () => {
  const asked = R.startQuestion(R.newShift(), 'Who paid?');
  const shift = R.finishQuestion(asked.shift, asked.request.id, { reply: 'Mistral!', mood: 'happy', cracked: false, notes: ['Says Mistral paid.'] });
  assert.deepEqual(shift.cases.max.notes, ['Says Mistral paid.']);
  assert.deepEqual(shift.cases.rupert.notes, []);
});

test('a bad verdict is refused', () => {
  assert.equal(R.stamp(R.newShift(), 'maybe').error, 'badVerdict');
});

test('a restarted shift never accepts a reply from the old one', () => {
  const started = R.startQuestion(R.newShift(), 'Why?');
  const fresh = R.restartShift(started.shift);
  const next = R.startQuestion(fresh, 'Hello?');
  assert.notEqual(next.request.id, started.request.id);
  assert.equal(R.finishQuestion(next.shift, started.request.id, { reply: 'x', mood: 'sad', cracked: false }), next.shift);
});

test('the request sent to the server carries past exchanges with their real cracked flag', () => {
  const shift = askAndAnswer(R.newShift());
  const { request } = R.startQuestion(shift, 'And?');
  assert.deepEqual(Object.keys(request.history[0]).sort(), ['cracked', 'mood', 'question', 'reply']);
  assert.equal(R.validateAskRequest({ travellerId: request.travellerId, question: request.question, history: request.history }).ok, true);
});

// ---- Bribes (Shahil 14:34) ----
// A bribe is a last-ditch offer, never part of the questioning: the first
// TURNED AWAY on a traveller doesn't land, and he offers what his own file
// in src/travellers/ says. The game decides when; the model never does.
// A fixed queue, so changing the demo queue in src/travellers/index.js never breaks these.
const PAIR = ['max', 'colin'];
const reachForAway = (shift) => R.stamp(shift, 'away');
const offerOf = (id) => ({ travellerId: id, ...getTraveller(id).bribe });

test('no bribe is on offer before the inspector reaches for TURNED AWAY', () => {
  let shift = R.newShift(PAIR);
  for (let i = 0; i < 5; i += 1) shift = askAndAnswer(shift);
  assert.equal(R.bribeOffer(shift), null);
  assert.equal(R.takeBribe(shift).error, 'noBribe');
  // A THROUGH stamp never brings one out either.
  shift = R.stamp(shift, 'through').shift;
  assert.equal(shift.cases.max.bribe, null);
  assert.equal(R.bribeOffer(shift), null);
});

test('the first TURNED AWAY does not land: he makes his offer instead', () => {
  const asked = R.startQuestion(R.newShift(PAIR), 'Why?');
  const { shift, offer, error } = reachForAway(asked.shift);
  assert.equal(error, undefined);
  assert.deepEqual(offer, offerOf('max'));
  assert.deepEqual(R.bribeOffer(shift), offer);
  assert.deepEqual([shift.current, shift.cases.max.stamp, shift.phase], [0, null, 'playing']);
  // The question that was out is dropped, as a stamp drops it.
  assert.equal(shift.pending, null);
  assert.equal(R.finishQuestion(shift, asked.request.id, { reply: 'x', mood: 'sad', cracked: false }), shift);
});

test('one offer per traveller: TURNED AWAY again refuses it, and the stamp lands', () => {
  const offered = reachForAway(R.newShift(PAIR)).shift;
  assert.equal(R.pleadsFirst(offered, 'away'), false);
  const refused = R.stamp(offered, 'away');
  assert.equal(refused.offer, undefined);
  assert.deepEqual([refused.shift.cases.max.stamp, refused.shift.cases.max.bribe, refused.shift.current], ['away', 'refused', 1]);
  assert.equal(R.bribeOffer(refused.shift), null);
  assert.equal(R.shiftReport(refused.shift).record, 'clean');
});

test('every traveller makes his own offer, the honest one too, so a bribe is never a tell', () => {
  const pastMax = R.stamp(reachForAway(R.newShift(PAIR)).shift, 'away').shift;
  assert.equal(getTraveller('colin').truth.honest, true);
  assert.deepEqual(reachForAway(pastMax).offer, offerOf('colin'));
});

test('taking the bribe lets him THROUGH and makes the record CORRUPT', () => {
  const { shift, error } = R.takeBribe(reachForAway(R.newShift(PAIR)).shift);
  assert.equal(error, undefined);
  assert.deepEqual([shift.cases.max.stamp, shift.cases.max.bribe, shift.current], ['through', 'taken', 1]);
  assert.equal(R.bribeOffer(shift), null);
  assert.equal(R.takeBribe(shift).error, 'noBribe');
  const report = R.shiftReport(shift);
  assert.deepEqual([report.bribesTaken, report.record], [1, 'corrupt']);
  assert.deepEqual(report.rows.map((r) => [r.id, r.bribeTaken]), [['max', true], ['colin', false]]);
});

test('THROUGH while the offer is out lets him through without taking it', () => {
  const { shift } = R.stamp(reachForAway(R.newShift(PAIR)).shift, 'through');
  assert.deepEqual([shift.cases.max.stamp, shift.cases.max.bribe], ['through', 'refused']);
  assert.equal(R.shiftReport(shift).record, 'clean');
});

test('while the offer is on the ledge there are no more questions: take it or stamp', () => {
  const offered = reachForAway(R.newShift(PAIR)).shift;
  assert.equal(R.startQuestion(offered, 'Is that a bribe?').error, 'bribeOnTable');
});

test('the clock stands still while he pleads, and runs again once he has said it', () => {
  const offered = reachForAway(R.newShift(PAIR)).shift;
  const left = (shift) => R.travellerTimeLeftMs(R.tick(shift, 1000));
  assert.equal(left(offered), R.TRAVELLER_MS);
  assert.equal(left(R.setPleading(offered, false)), R.TRAVELLER_MS - 1000);
  // Answering the offer, either way, starts the clock again too: on the next traveller's two minutes.
  assert.equal(left(R.takeBribe(offered).shift), R.TRAVELLER_MS - 1000);
  assert.equal(left(R.stamp(offered, 'away').shift), R.TRAVELLER_MS - 1000);
});

test('the score comes only from the stored truth: a bribe never changes right or wrong', () => {
  const takeBoth = (shift) => R.takeBribe(reachForAway(R.takeBribe(reachForAway(shift).shift).shift).shift).shift;
  const bought = R.shiftReport(takeBoth(R.newShift(PAIR)));
  // The liar let through for a croissant is wrong; the honest one is right, and the record is corrupt.
  assert.deepEqual(bought.rows.map((r) => [r.id, r.stamp, r.correct]), [['max', 'through', false], ['colin', 'through', true]]);
  assert.deepEqual([bought.correct, bought.bribesTaken, bought.record], [1, 2, 'corrupt']);
  // Refusing both: turning the liar away is right, turning the honest one away is wrong.
  const refuseBoth = (shift) => R.stamp(reachForAway(R.stamp(reachForAway(shift).shift, 'away').shift).shift, 'away').shift;
  const refused = R.shiftReport(refuseBoth(R.newShift(PAIR)));
  assert.deepEqual(refused.rows.map((r) => [r.id, r.stamp, r.correct]), [['max', 'away', true], ['colin', 'away', false]]);
  assert.deepEqual([refused.correct, refused.record], [1, 'clean']);
});

test('a reply cannot make or take an offer', () => {
  const asked = R.startQuestion(R.newShift(PAIR), 'Well?');
  const shift = R.finishQuestion(asked.shift, asked.request.id, { reply: 'A croissant?', mood: 'happy', cracked: false, bribe: true, bribeTaken: true });
  assert.equal(shift.cases.max.bribe, null);
  assert.equal('bribe' in shift.cases.max.history[0], false);
  assert.equal(R.bribeOffer(shift), null);
});

test('Play again starts with a clean record and a fresh offer from everyone', () => {
  const fresh = R.restartShift(R.takeBribe(reachForAway(R.newShift(PAIR)).shift).shift);
  assert.equal(fresh.cases.max.bribe, null);
  assert.equal(R.shiftReport(fresh).record, 'clean');
  assert.deepEqual(reachForAway(fresh).offer, offerOf('max'));
});

// The pause menu
test('both clocks stand still while the game is paused, and run again on resume', () => {
  const paused = R.setPaused(R.newShift(), true);
  const waited = R.tick(paused, 30_000);
  assert.equal(R.timeLeftMs(waited), R.timeLeftMs(R.newShift()));
  assert.equal(R.travellerTimeLeftMs(waited), R.TRAVELLER_MS);
  assert.equal(R.travellerTimeLeftMs(R.tick(R.setPaused(waited, false), 1000)), R.TRAVELLER_MS - 1000);
});

test('Restart shift from the pause menu is a fresh, running shift with nothing carried over', () => {
  let shift = askAndAnswer(R.newShift());
  shift = R.tick(R.stamp(shift, 'through').shift, 5000);
  const fresh = R.restartShift(R.setPaused(shift, true));
  assert.equal(fresh.paused, false);
  assert.equal(fresh.current, 0);
  assert.equal(fresh.usedMs, 0);
  for (const id of fresh.queue) assert.deepEqual(fresh.cases[id], { history: [], notes: [], lookups: [], stamp: null, bribe: null });
  // A reply still in flight from the old shift can't land in the new one.
  assert.ok(fresh.nextRequestId >= shift.nextRequestId);
});

test('a finished shift cannot be paused', () => {
  let shift = R.newShift();
  while (shift.phase === 'playing') {
    const next = R.stamp(shift, 'through');
    shift = next.shift;
  }
  assert.equal(R.setPaused(shift, true), shift);
});
