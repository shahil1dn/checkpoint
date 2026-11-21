// The shift clock (Shahil 15:25): three travellers, two minutes each, a
// six-minute shift. Each traveller has his own two minutes; when they run
// out, the questions stop and the inspector has to stamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import { mockReply } from '../src/mockBrain.js';

const TWO_MINUTES = 2 * 60 * 1000;

function askAndAnswer(shift, text = 'Why are you here?') {
  const started = R.startQuestion(shift, text);
  assert.equal(started.error, undefined);
  return R.finishQuestion(started.shift, started.request.id, R.parseReply(mockReply(started.request)));
}

test('a shift is three travellers with two minutes each, so the shift clock starts at six minutes', () => {
  const shift = R.newShift();
  assert.equal(shift.queue.length, 3);
  assert.equal(R.TRAVELLER_MS, TWO_MINUTES);
  assert.equal(R.travellerTimeLeftMs(shift), TWO_MINUTES);
  assert.equal(R.timeLeftMs(shift), 3 * TWO_MINUTES);
});

test("when a traveller's two minutes run out, the questions stop but he can still be stamped", () => {
  const shift = R.tick(R.newShift(), TWO_MINUTES);
  assert.equal(shift.phase, 'playing');
  assert.equal(R.travellerTimeLeftMs(shift), 0);
  const asked = R.startQuestion(shift, 'One more?');
  assert.equal(asked.error, 'outOfTime');
  assert.equal(asked.shift, shift);
  const { shift: next, error } = R.stamp(shift, 'through');
  assert.equal(error, undefined);
  assert.equal(R.currentTravellerId(next), shift.queue[1]);
  assert.equal(R.travellerTimeLeftMs(next), TWO_MINUTES);
  assert.equal(R.startQuestion(next, 'Why are you here?').error, undefined);
});

test("one traveller's clock never eats into the next one's", () => {
  const shift = R.tick(R.newShift(), 10 * TWO_MINUTES);
  assert.equal(R.travellerTimeLeftMs(shift), 0);
  assert.equal(R.timeLeftMs(shift), 2 * TWO_MINUTES);
});

test("stamping early doesn't pass his spare time on: the next traveller gets two minutes", () => {
  const halfWay = R.tick(R.newShift(), 30_000);
  assert.equal(R.timeLeftMs(halfWay), 3 * TWO_MINUTES - 30_000);
  const next = R.stamp(halfWay, 'through').shift;
  assert.equal(R.travellerTimeLeftMs(next), TWO_MINUTES);
  assert.equal(R.timeLeftMs(next), 2 * TWO_MINUTES);
  assert.equal(R.travellerTimeLeftMs(R.tick(next, 1000)), TWO_MINUTES - 1000);
});

test("his clock waits while Mistral thinks, so the wait never costs him time", () => {
  let shift = R.tick(R.newShift(), TWO_MINUTES - 1000);
  const started = R.startQuestion(shift, 'Quick, why are you here?');
  shift = R.tick(started.shift, 60_000);
  shift = R.finishQuestion(shift, started.request.id, R.parseReply(mockReply(started.request)));
  assert.equal(R.travellerTimeLeftMs(shift), 1000);
  assert.equal(R.startQuestion(shift, 'And?').error, undefined);
});

test('the 5-question limit still holds with time to spare', () => {
  let shift = R.newShift();
  for (let i = 0; i < R.MAX_QUESTIONS; i += 1) shift = askAndAnswer(shift);
  assert.ok(R.travellerTimeLeftMs(shift) > 0);
  assert.equal(R.startQuestion(shift, 'One more?').error, 'outOfQuestions');
});

test('the shift only ends when the last traveller is stamped, never on the clock', () => {
  let shift = R.newShift();
  for (let i = 0; i < 3; i += 1) {
    shift = R.tick(shift, TWO_MINUTES + 5000);
    assert.equal(shift.phase, 'playing');
    shift = R.stamp(shift, 'through').shift;
  }
  assert.equal(shift.phase, 'over');
  assert.equal(shift.endReason, 'queueEmpty');
  assert.equal(R.timeLeftMs(shift), 0);
  assert.equal(R.travellerTimeLeftMs(shift), 0);
  assert.equal(R.tick(shift, 1000), shift);
});

test('his clock also waits while his answer is being spoken', () => {
  let shift = R.setSpeaking(R.newShift(), true);
  shift = R.tick(shift, 8000);
  assert.equal(R.travellerTimeLeftMs(shift), TWO_MINUTES);
  shift = R.tick(R.setSpeaking(shift, false), 8000);
  assert.equal(R.travellerTimeLeftMs(shift), TWO_MINUTES - 8000);
});
