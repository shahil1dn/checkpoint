import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import { mockReply } from '../src/mockBrain.js';

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
  const report = R.shiftReport(shift);
  assert.deepEqual(report.rows.map((r) => [r.id, r.stamp, r.honest, r.correct]), [
    ['max', 'through', false, false],
    ['colin', 'through', true, true],
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

test('the shift ends when the clock runs out, and nothing more can happen', () => {
  const shift = R.tick(R.newShift(), R.SHIFT_MS + 5000);
  assert.equal(shift.phase, 'over');
  assert.equal(shift.endReason, 'time');
  assert.equal(R.timeLeftMs(shift), 0);
  assert.equal(R.startQuestion(shift, 'Hi').error, 'shiftOver');
  assert.equal(R.stamp(shift, 'away').error, 'shiftOver');
  const report = R.shiftReport(shift);
  assert.equal(report.correct, 0);
  assert.equal(report.rows[0].stamp, null);
});

test('stamping is allowed before the first question, and the queue moves on', () => {
  const { shift, error } = R.stamp(R.newShift(), 'away');
  assert.equal(error, undefined);
  assert.equal(R.currentTravellerId(shift), 'colin');
  const done = R.stamp(shift, 'through').shift;
  assert.equal(done.phase, 'over');
  assert.equal(done.endReason, 'queueEmpty');
  assert.equal(R.shiftReport(done).correct, 2);
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
