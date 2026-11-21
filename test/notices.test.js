// The right wall is flavour only (SPEC "Looking around the booth"): none of its
// words may point at a traveller, his papers or his story.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAVELLERS } from '../src/travellers/index.js';
import { ALL_WORDS } from '../public/notices.js';

const wall = ALL_WORDS.join('\n');
const word = (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

for (const t of TRAVELLERS) {
  test(`${t.id}: nothing on the right wall names him, his papers or his story`, () => {
    for (const name of t.name.split(' ')) assert.doesNotMatch(wall, word(name));
    for (const hint of t.hearingHints ?? []) assert.doesNotMatch(wall, word(hint));
    for (const value of Object.values(t.papers)) {
      for (const part of value.split(/[,()]/).map((s) => s.trim()).filter((s) => s.length > 3)) {
        assert.doesNotMatch(wall, word(part), `papers line "${value}"`);
      }
    }
  });
}

test('the right wall says nothing about lying, spying, sponsors, tickets or cheese', () => {
  assert.doesNotMatch(wall, /\b(lie|lies|liar|lying|honest|truth|secret|spy|spies|spying|sponsor\w*|ticket|cheese|paris)\b/i);
});

test('the notices module imports nothing, so it cannot reach traveller data', () => {
  const source = readFileSync(new URL('../public/notices.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
});
