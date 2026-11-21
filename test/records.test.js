// The border's records (ADR-12): big enough that the search is real, the same
// on every run, and never a verdict or a traveller's secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVE } from '../src/records/archive.js';
import { runTool, likeness } from '../src/records/search.js';
import { documentsFor, nameOnDocuments } from '../src/records/index.js';
import { hasVerdictWord } from '../src/rules.js';
import { TRAVELLERS } from '../src/travellers/index.js';

const everything = JSON.stringify(ARCHIVE);

test('the archive holds a few hundred entries, the same every run', async () => {
  assert.ok(ARCHIVE.passengers.length + ARCHIVE.people.length + ARCHIVE.companies.length >= 300);
  const again = await import(`../src/records/archive.js?again=${Date.now()}`);
  assert.equal(JSON.stringify(again.ARCHIVE), everything);
});

test('no record and no ticket holds a verdict word', () => {
  const texts = [everything, ...TRAVELLERS.map((t) => JSON.stringify(documentsFor(t)))];
  for (const text of texts) assert.ok(!hasVerdictWord(text), text.match(/.{0,40}(lie|liar|lying|truth|honest|suspic|suspect|guilt|innocen).{0,40}/i)?.[0]);
});

test("no record holds a traveller's secret, prompt or truth", () => {
  for (const t of TRAVELLERS) {
    assert.ok(!everything.includes(t.truth.secret));
    for (let i = 0; i + 40 <= t.prompt.length; i += 20) assert.ok(!everything.includes(t.prompt.slice(i, i + 40)), `${t.id} prompt`);
  }
  assert.doesNotMatch(everything, /\bspy\b|"honest"/i);
});

test("Max's case folder holds a passport, a visa and a ticket whose lines clash", () => {
  const max = TRAVELLERS.find((t) => t.id === 'max');
  const [passport, visa, ticket] = documentsFor(max);
  assert.deepEqual([passport.kind, visa.kind, ticket.kind], ['passport', 'visa', 'ticket']);
  assert.equal(passport.fields.Occupation, 'Freelance prompt artisan');
  assert.equal(visa.fields.Sponsor, 'Frontier Horizon Labs');
  assert.equal(ticket.fields.Ship, 'Seine Star');
  assert.equal(nameOnDocuments(max), 'Maximilian Tokens');
  // The innocent oddity: the long name is still him in the registry.
  assert.equal(runTool('find_person', { name: 'Maximilian Tokens' }).result.matches[0].match, 'exact');
});

test("Max's ship has no Tokens on its list, but an M. Tokkens sailed on the account that paid", () => {
  assert.equal(runTool('search_passenger_lists', { name: 'Max Tokens', ship: 'Seine Star' }).result.matches.length, 0);
  const paid = runTool('search_passenger_lists', { ticket_or_account: 'FHL-0042' }).result.matches;
  assert.deepEqual(paid.map((p) => [p.name, p.ship]), [['M. Tokkens', 'Golden Gate Glider']]);
  const company = runTool('find_company', { name: 'Frontier Horizon Labs' }).result.matches[0];
  assert.match(company.note, /direct competition with Mistral AI/);
});

test("Colin's misspelled name is a near match on the delayed Paris ship", () => {
  const { result, step } = runTool('search_passenger_lists', { name: 'Colin Stilton', ship: 'Paris' });
  assert.equal(result.ships[0].name, 'Seine Star');
  assert.match(result.ships[0].note, /delayed/);
  assert.deepEqual(result.matches.map((m) => [m.name, m.match]), [['Colin Stiltn', 'near']]);
  assert.match(step, /^Seine Star list \(\d+\): "Colin Stilton"… 1 near match$/);
});

test('names match in any order and through common misspellings, but not loosely', () => {
  assert.equal(likeness('Max Tokens', 'Tokens, Max'), 1);
  assert.ok(likeness('Max Tokens', 'M. Tokkens') >= 0.7);
  assert.ok(likeness('Max Tokens', 'Mabel Floe') < 0.7);
});

test('a tool call with junk arguments or an unknown name is answered, not thrown', () => {
  assert.match(runTool('delete_everything', {}).result.error, /no tool/);
  assert.doesNotThrow(() => runTool('find_person', { name: 42, extra: { nested: true } }));
  assert.equal(runTool('find_person', { name: 'x'.repeat(500) }).result.matches.length, 0);
});

test("Granny's gaps and Rupert's consistency are findable in the records", () => {
  const buyer = runTool('find_company', { name: 'Edna Pebble' }).result.matches[0];
  assert.equal(buyer.name, 'Southern Krill Exchange');
  assert.match(buyer.note, /E\. Pebble/);
  assert.match(runTool('search_passenger_lists', { name: 'Edna Pebble' }).result.matches[0].freight, /41 kg/);
  const fund = runTool('find_company', { name: 'Thamesbridge Capital' }).result.matches[0];
  assert.match(fund.note, /Return charter booked for the whole group/);
  assert.equal(runTool('search_passenger_lists', { name: 'Rupert Ashworth-Hale' }).result.matches[0].name, 'Rupert Ashworth-Hail');
});

test('every traveller in the queue hands over a passport, a visa and a ticket of at most 6 lines each', async () => {
  const { QUEUE, getTraveller } = await import('../src/travellers/index.js');
  for (const id of QUEUE) {
    const docs = documentsFor(getTraveller(id));
    assert.deepEqual(docs.map((d) => d.kind), ['passport', 'visa', 'ticket'], id);
    for (const doc of docs) assert.ok(Object.keys(doc.fields).length <= 6, `${id} ${doc.kind}`);
  }
});
