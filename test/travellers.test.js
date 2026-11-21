// Every traveller file must be complete, so a teammate's broken or forgotten
// traveller fails check.sh instead of breaking the game in the middle of a shift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { TRAVELLERS, TRAVELLER_IDS } from '../src/travellers/index.js';
import { MOODS } from '../src/rules.js';

const folder = new URL('../src/travellers/', import.meta.url);
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

test('every traveller file is listed in src/travellers/index.js, and its id is its file name', () => {
  const files = readdirSync(folder).filter((f) => f.endsWith('.js') && f !== 'index.js').map((f) => f.slice(0, -3)).sort();
  assert.deepEqual([...TRAVELLER_IDS].sort(), files);
  assert.equal(new Set(TRAVELLER_IDS).size, TRAVELLER_IDS.length, 'two travellers share an id');
});

for (const t of TRAVELLERS) {
  test(`${t.id ?? '(no id)'}: has a name, papers, truth, prompt and voice`, () => {
    assert.match(t.id ?? '', /^[a-z]+$/, 'id: lower-case letters only');
    assert.ok(nonEmpty(t.name), 'name');
    assert.ok(t.papers && Object.keys(t.papers).length > 0, 'papers: at least one line');
    for (const [label, value] of Object.entries(t.papers)) assert.ok(nonEmpty(value), `papers: "${label}" is empty or not text`);
    assert.ok(t.truth, 'truth is missing: the score needs it');
    assert.equal(typeof t.truth.honest, 'boolean', 'truth.honest: true or false');
    assert.ok(nonEmpty(t.truth.secret), 'truth.secret');
    assert.ok(nonEmpty(t.prompt), 'prompt');
    assert.ok(nonEmpty(t.voice) || nonEmpty(t.voices?.neutral), 'a voice: voice, or voices with a neutral one');
  });

  test(`${t.id}: optional parts are well formed`, () => {
    for (const word of t.hearingHints ?? []) assert.match(word, /^\S+$/, `hearingHints: "${word}" must be one word`);
    for (const line of t.offlineLines ?? []) {
      assert.ok(nonEmpty(line.reply), 'offlineLines: reply');
      assert.ok(MOODS.includes(line.mood), `offlineLines: mood "${line.mood}" is not one of ${MOODS.join(', ')}`);
    }
    if (t.look !== undefined) assert.equal(typeof t.look, 'object', 'look');
  });
}
