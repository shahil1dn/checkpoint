// Every traveller file must be complete, so a teammate's broken or forgotten
// traveller fails check.sh instead of breaking the game in the middle of a shift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { TRAVELLERS, TRAVELLER_IDS } from '../src/travellers/index.js';
import { BRIBE_ITEMS, MOODS, bribeOffer, newShift, stamp } from '../src/rules.js';

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

  // A bribe is optional (Shahil 16:05): with one, his first TURNED AWAY brings
  // it out instead of landing (ADR-13); without one, the stamp lands at once.
  // The format, in the traveller file:
  //   bribe: { line: 'Wait, wait! ...', item: 'sticker', mood: 'excited' }
  test(`${t.id}: a bribe, if he has one, is well formed`, () => {
    if (!('bribe' in t)) return;
    assert.ok(t.bribe !== null && typeof t.bribe === 'object', 'bribe: leave it out for no bribe, or give { line, item, mood }');
    assert.ok(nonEmpty(t.bribe.line), 'bribe.line: what he says, out loud, when you reach for TURNED AWAY');
    assert.ok(Object.hasOwn(BRIBE_ITEMS, t.bribe.item), `bribe.item: one of ${Object.keys(BRIBE_ITEMS).join(', ')} (a new item needs BRIBE_ITEMS in src/rules.js and a drawing in public/booth.js)`);
    assert.ok(MOODS.includes(t.bribe.mood), `bribe.mood: the voice and face he says it with, one of ${MOODS.join(', ')}`);
  });

  test(`${t.id}: his first TURNED AWAY ${t.bribe ? 'brings out his own bribe, not the stamp' : 'lands at once'}`, () => {
    const { shift, offer } = stamp(newShift([t.id]), 'away');
    if (t.bribe) {
      assert.deepEqual(offer, { travellerId: t.id, ...t.bribe });
      assert.equal(shift.cases[t.id].stamp, null);
    } else {
      assert.equal(offer, undefined);
      assert.equal(shift.cases[t.id].stamp, 'away');
    }
  });

  test(`${t.id}: optional parts are well formed`, () => {
    for (const word of t.hearingHints ?? []) assert.match(word, /^\S+$/, `hearingHints: "${word}" must be one word`);
    for (const line of t.offlineLines ?? []) {
      assert.ok(nonEmpty(line.reply), 'offlineLines: reply');
      assert.ok(MOODS.includes(line.mood), `offlineLines: mood "${line.mood}" is not one of ${MOODS.join(', ')}`);
      assert.equal('bribe' in line, false, 'offlineLines: bribes come only when you reach for TURNED AWAY');
    }
    if (t.look !== undefined) assert.equal(typeof t.look, 'object', 'look');
  });
}

// The roster may have nobody without a bribe yet, so for this test one
// traveller's bribe is taken out and put back afterwards.
test('a traveller with no bribe: his first TURNED AWAY lands at once, with nothing on offer', () => {
  const traveller = TRAVELLERS.find((t) => t.bribe) ?? TRAVELLERS[0];
  const kept = traveller.bribe;
  delete traveller.bribe;
  try {
    const { shift, offer } = stamp(newShift([traveller.id]), 'away');
    assert.equal(offer, undefined);
    assert.deepEqual([shift.cases[traveller.id].stamp, shift.cases[traveller.id].bribe, shift.phase], ['away', null, 'over']);
    assert.equal(bribeOffer(shift), null);
  } finally {
    if (kept !== undefined) traveller.bribe = kept;
  }
});
