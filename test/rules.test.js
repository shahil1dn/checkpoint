import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';

test('a question is trimmed and counted by visible characters', () => {
  assert.deepEqual(R.checkQuestion('  hi  '), { ok: true, question: 'hi' });
  assert.equal(R.checkQuestion('🧀'.repeat(300)).ok, true);
  assert.equal(R.checkQuestion('🧀'.repeat(301)).reason, 'tooLong');
  assert.equal(R.checkQuestion('').reason, 'empty');
  assert.equal(R.checkQuestion(42).reason, 'empty');
});

test('an ask request keeps only the known fields of past exchanges', () => {
  const checked = R.validateAskRequest({
    travellerId: 'max', question: 'Why?', history: [{ question: 'a', reply: 'b', extra: 'x' }],
  });
  assert.equal(checked.ok, true);
  assert.deepEqual(checked.value.history, [{ question: 'a', reply: 'b', mood: 'neutral' }]);
});

test('a past exchange with an unknown mood is refused', () => {
  const checked = R.validateAskRequest({
    travellerId: 'max', question: 'Why?', history: [{ question: 'a', reply: 'b', mood: 'furious' }],
  });
  assert.equal(checked.reason, 'badHistory');
});

// A5: a broken model reply can't break the game.
test('an off-list mood, a 900-character reply and markdown come out safe', () => {
  const raw = JSON.stringify({ reply: `**bold** ${'a'.repeat(900)}`, mood: 'furious', cracked: 'yes' });
  const reply = R.parseReply(raw);
  assert.equal(reply.mood, 'neutral');
  assert.equal([...reply.reply].length, 300);
  assert.ok(reply.reply.startsWith('bold aaa'));
  assert.doesNotMatch(reply.reply, /[*_`#]/);
  assert.equal(reply.cracked, false);
});

test('a reply that is not JSON, or has no reply text, is unusable', () => {
  assert.equal(R.parseReply('not json'), null);
  assert.equal(R.parseReply('[]'), null);
  assert.equal(R.parseReply('{"mood":"happy"}'), null);
  assert.equal(R.parseReply('{"reply":"  ** "}'), null);
});
