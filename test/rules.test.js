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
  assert.deepEqual(checked.value.history, [{ question: 'a', reply: 'b', mood: 'neutral', cracked: false }]);
});

test('confessions: honest ignored, liar refused before question 3, accepted from 3', () => {
  const colin = { truth: { honest: true } };
  const max = { truth: { honest: false } };
  const cracked = { reply: 'I did it', mood: 'sad', cracked: true };
  assert.deepEqual(R.judgeReply(colin, 4, cracked), { ok: true, reply: { ...cracked, cracked: false } });
  assert.deepEqual(R.judgeReply(max, 2, cracked), { ok: false, reason: 'earlyConfession' });
  assert.deepEqual(R.judgeReply(max, 3, cracked), { ok: true, reply: cracked });
  assert.equal(R.judgeReply(max, 1, { ...cracked, cracked: false }).ok, true);
});

// A12: notes never give a verdict.
test('every verdict word, a tick or a cross gets a note refused', () => {
  const words = ['lie', 'liar', 'lying', 'truth', 'honest', 'suspicious', 'guilty', 'innocent', '✓', '✗',
    'Lies about the sponsor', 'Sounds dishonest', 'Truthful so far', 'Honestly odd'];
  for (const word of words) {
    const { kept, refused } = R.checkNotes(JSON.stringify({ notes: [`Note: ${word}`] }));
    assert.deepEqual([kept, refused], [[], 1], word);
  }
});

test('a plain observation is kept, even with words that contain a verdict word', () => {
  const notes = ['Believes the hackathon is in Paris.', 'Papers say 40 kg; he said "a few wheels".'];
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes })), { kept: notes, refused: 0, falseClash: 0 });
});

test('a 3rd note in one answer and a note over 120 characters are refused', () => {
  const three = R.checkNotes(JSON.stringify({ notes: ['One.', 'Two.', 'Three.'] }));
  assert.deepEqual(three, { kept: ['One.', 'Two.'], refused: 1, falseClash: 0 });
  const long = R.checkNotes(JSON.stringify({ notes: ['a'.repeat(121), 'b'.repeat(120)] }));
  assert.deepEqual(long, { kept: ['b'.repeat(120)], refused: 1, falseClash: 0 });
});

test('a two-sided note where both sides say the same thing is dropped; a real clash is kept', () => {
  const same = ['Says Stilton; papers say Colin Stilton', "Says 'Stilton, Cambridgeshire'; papers say 'Stilton'", 'Says Frontier Horizon Labs paid; papers say Frontier Horizon Labs'];
  const real = ["Says 'a kind sponsor from my local AI meetup'; papers say 'Frontier Horizon Labs'", "Says 'Every few days'; papers say '9'"];
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes: same.slice(0, 2) })), { kept: [], refused: 0, falseClash: 2 });
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes: [same[2]] })).falseClash, 1);
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes: real })), { kept: real, refused: 0, falseClash: 0 });
});

test('with the papers given, a "papers say" that is not on the papers is dropped', () => {
  const papers = { Name: 'Max Tokens', 'Ticket sponsored by': 'Frontier Horizon Labs', 'Visits this month': '9' };
  const madeUp = ["Says 'Le Grand'; papers say 'Mistral Large'", 'Says The Mistral Inn; papers say no address'];
  const quoted = ["Says 'a fan club'; papers say 'Frontier Horizon Labs'", 'Says a fan paid; papers say ticket sponsored by Frontier Horizon Labs', "Says 'every few days'; papers say '9'"];
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes: madeUp }), papers), { kept: [], refused: 0, falseClash: 2 });
  for (const note of quoted) assert.deepEqual(R.checkNotes(JSON.stringify({ notes: [note] }), papers).kept, [note], note);
  assert.deepEqual(R.checkNotes(JSON.stringify({ notes: ['Offered a sticker.'] }), papers).kept, ['Offered a sticker.']);
});

test('broken note output shows no notes rather than breaking', () => {
  assert.deepEqual(R.checkNotes('not json'), { kept: [], refused: 0, falseClash: 0 });
  assert.deepEqual(R.checkNotes('{"notes":"one"}'), { kept: [], refused: 0, falseClash: 0 });
  assert.deepEqual(R.checkNotes('{"notes":[42,"",null," ok "]}'), { kept: ['ok'], refused: 0, falseClash: 0 });
});

test('a past exchange with a cracked flag that is not true or false is refused', () => {
  const checked = R.validateAskRequest({ travellerId: 'max', question: 'Why?', history: [{ question: 'a', reply: 'b', cracked: 'yes' }] });
  assert.equal(checked.reason, 'badHistory');
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
