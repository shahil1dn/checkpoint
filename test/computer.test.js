// The inspector's computer must never show what the player shouldn't see: no
// truth, no secret, no prompt (the same idea as A11 for the note-taker).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAVELLERS } from '../src/travellers/index.js';
import { lineForHeard, lineForSpeech, lineForTyped, linesForAnswer, modelName } from '../public/computer.js';

const MODELS = { hear: 'voxtral-mini-latest', answer: 'mistral-medium-3.5', notes: 'mistral-medium-3.5', speech: 'voxtral-mini-tts-3' };

test('model names read as plain names', () => {
  assert.equal(modelName('mistral-medium-3.5'), 'Medium 3.5');
  assert.equal(modelName('voxtral-mini-latest'), 'Voxtral Mini');
  assert.equal(modelName('voxtral-mini-tts-3'), 'Voxtral Mini TTS 3');
  assert.equal(modelName(undefined), 'Mistral');
});

test('a line shows the model, what it did and the real timing', () => {
  const answer = { reply: 'Hello', mood: 'happy', cracked: false, notes: ['Says x; papers say y'], timings: { answerMs: 523, notesMs: 910, speechMs: 1200 } };
  const lines = linesForAnswer(answer, 'Max Tokens', MODELS);
  assert.deepEqual(lines[0], { who: 'Medium 3.5', what: 'answered Max Tokens in 0.52 s' });
  assert.deepEqual(lines[1], { who: 'Note-taker, Medium 3.5', what: 'added a note in 0.91 s' });
  assert.deepEqual(lineForHeard({ text: 'Who paid?', ms: 812 }, MODELS), { who: 'Voxtral Mini', what: 'heard "Who paid?" in 0.81 s' });
  assert.deepEqual(lineForSpeech(4.13, 1200, MODELS), { who: 'Voxtral Mini TTS 3', what: 'spoke 4.1 s of audio, made in 1.20 s' });
});

// Even if a traveller's private parts ever reached the answer the page gets,
// the screen reads only the fields it names.
for (const t of TRAVELLERS) {
  test(`${t.id}: the computer screen never shows his truth, secret or prompt`, () => {
    const leaky = {
      reply: 'Just here for the hackathon.', mood: 'neutral', cracked: false, notes: [], audio: 'QUJD',
      timings: { answerMs: 500, notesMs: 600, speechMs: 700 },
      truth: t.truth, secret: t.truth.secret, prompt: t.prompt, papers: t.papers,
    };
    const shown = [
      ...linesForAnswer(leaky, t.name, MODELS),
      lineForHeard({ text: 'What brings you here?', ms: 400 }, MODELS),
      lineForTyped('Are you lying?'),
      lineForSpeech(3.2, 700, MODELS),
    ].map((line) => `${line.who} ${line.what}`).join('\n');
    assert.ok(!shown.includes(t.truth.secret), 'secret shown');
    for (let i = 0; i + 40 <= t.prompt.length; i += 20) assert.ok(!shown.includes(t.prompt.slice(i, i + 40)), 'prompt shown');
    assert.doesNotMatch(shown, /honest|"secret"|truth/i);
  });
}

test('the computer module imports nothing, so it cannot reach traveller data', () => {
  const source = readFileSync(new URL('../public/computer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});
