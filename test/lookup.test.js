// The records terminal's rules (ADR-12): 3 lookups per traveller, only lines
// the inspector has gathered, and reports with no verdict in them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/rules.js';
import { getTraveller } from '../src/travellers/index.js';
import { documentsFor } from '../src/records/index.js';

const SPONSOR = 'Ticket sponsored by: Frontier Horizon Labs';
const result = { steps: ['searched the company register'], answer: ['Company register: an AI lab.'] };

function lookUp(shift, line) {
  const started = R.startLookup(shift, line);
  assert.ok(!started.error, started.error);
  return R.finishLookup(started.shift, started.request.id, result);
}

test('a 4th lookup on one traveller is refused and costs nothing', () => {
  let shift = R.newShift(['max', 'colin']);
  for (const line of [SPONSOR, 'Name: Max Tokens', 'Ship: Seine Star']) shift = lookUp(shift, line);
  assert.equal(R.lookupsLeft(shift, 'max'), 0);
  const fourth = R.startLookup(shift, 'From: Paris (he says)');
  assert.equal(fourth.error, 'outOfLookups');
  assert.equal(fourth.shift.cases.max.lookups.length, 3);
  assert.equal(fourth.shift.lookup, null);
});

test('each traveller gets his own 3 lookups', () => {
  let shift = R.newShift(['max', 'colin']);
  for (const line of [SPONSOR, 'Name: Max Tokens', 'Ship: Seine Star']) shift = lookUp(shift, line);
  shift = R.stamp(shift, 'away').shift;
  assert.equal(R.lookupsLeft(shift, 'colin'), R.MAX_LOOKUPS);
});

test('a failed lookup is not counted', () => {
  const started = R.startLookup(R.newShift(['max']), SPONSOR);
  const shift = R.finishLookup(started.shift, started.request.id, null);
  assert.equal(R.lookupsLeft(shift, 'max'), 3);
  assert.equal(shift.lookup, null);
});

test('one lookup at a time, and the same line is never charged twice', () => {
  const started = R.startLookup(R.newShift(['max']), SPONSOR);
  assert.equal(R.startLookup(started.shift, 'Name: Max Tokens').error, 'lookupPending');
  const shift = R.finishLookup(started.shift, started.request.id, result);
  assert.equal(R.startLookup(shift, `  ${SPONSOR} `).error, 'alreadyLookedUp');
  assert.equal(R.lookupsLeft(shift, 'max'), 2);
});

test('a lookup that lands after the traveller was stamped is kept on his case only', () => {
  const started = R.startLookup(R.newShift(['max', 'colin']), SPONSOR);
  const stamped = R.stamp(started.shift, 'away').shift;
  const shift = R.finishLookup(stamped, started.request.id, result);
  assert.equal(shift.cases.max.lookups.length, 1);
  assert.equal(shift.cases.colin.lookups.length, 0);
});

test('the request carries the lines already looked up, for the server to count', () => {
  let shift = lookUp(R.newShift(['max']), SPONSOR);
  const { request } = R.startLookup(shift, 'Name: Max Tokens');
  assert.deepEqual(request, { id: request.id, travellerId: 'max', line: 'Name: Max Tokens', earlier: [SPONSOR] });
});

test('the server refuses a 4th lookup, a repeat, an unknown traveller and a bad line', () => {
  const ok = { travellerId: 'max', line: SPONSOR, earlier: [] };
  assert.deepEqual(R.validateLookupRequest(ok), { ok: true, value: ok });
  assert.equal(R.validateLookupRequest({ ...ok, earlier: ['a', 'b', 'c'] }).reason, 'outOfLookups');
  assert.equal(R.validateLookupRequest({ ...ok, earlier: [SPONSOR] }).reason, 'alreadyLookedUp');
  assert.equal(R.validateLookupRequest({ ...ok, travellerId: 'nobody' }).reason, 'unknownTraveller');
  assert.equal(R.validateLookupRequest({ ...ok, line: '' }).reason, 'empty');
  assert.equal(R.validateLookupRequest({ ...ok, line: 'x'.repeat(301) }).reason, 'tooLong');
  assert.equal(R.validateLookupRequest({ ...ok, earlier: 'no' }).reason, 'badEarlier');
  assert.equal(R.validateLookupRequest([]).reason, 'badBody');
});

test('only lines from his documents or his own answers count as gathered', () => {
  const gathered = { documents: documentsFor(getTraveller('max')), said: ['Frontier who? Never heard of them.'] };
  assert.equal(R.gatheredFrom('Sponsor: Frontier Horizon Labs', gathered), 'visa');
  assert.equal(R.gatheredFrom('Occupation: Freelance prompt artisan', gathered), 'passport');
  assert.equal(R.gatheredFrom('Ship: Seine Star', gathered), 'ticket');
  assert.equal(R.gatheredFrom('Frontier who?  Never heard of them. ', gathered), 'said');
  assert.equal(R.gatheredFrom('Is Frontier Horizon Labs a rival AI lab?', gathered), null);
  assert.equal(R.gatheredFrom('Sponsor: Mistral AI', gathered), null);
  // His old papers are not in the folder any more, so they aren't gathered.
  assert.equal(R.gatheredFrom(SPONSOR, gathered), null);
});

test('a traveller with no records file hands over his papers as one document', () => {
  const nobody = { id: 'nobody', name: 'Pat Floe', papers: { Name: 'Pat Floe', From: 'Hobart' } };
  assert.deepEqual(documentsFor(nobody), [{ kind: 'papers', title: 'Travel papers', fields: nobody.papers }]);
  assert.equal(R.gatheredFrom('From: Hobart', { documents: documentsFor(nobody) }), 'papers');
});

test('a 3-traveller queue gets 3 lookups each', () => {
  let shift = R.newShift(['max', 'colin', 'max']);
  for (const id of shift.queue) assert.equal(R.lookupsLeft(shift, id), R.MAX_LOOKUPS);
  shift = lookUp(shift, SPONSOR);
  assert.equal(R.lookupsLeft(shift, 'max'), 2);
  assert.equal(R.lookupsLeft(shift, 'colin'), 3);
});

test('a report keeps record lines and drops any line with a verdict word', () => {
  const raw = '- Company register: "Frontier Horizon Labs: AI research lab."\n* **Passenger lists:** no Tokens on the Seine Star.\nThis suggests he is lying.\n\nRulebook §4: the "Paid by" line names the account that paid.';
  const { lines, refused } = R.checkLookupAnswer(raw);
  assert.deepEqual(lines, [
    'Company register: "Frontier Horizon Labs: AI research lab."',
    'Passenger lists: no Tokens on the Seine Star.',
    'Rulebook §4: the "Paid by" line names the account that paid.',
  ]);
  assert.equal(refused, 1);
  assert.deepEqual(R.checkLookupAnswer('He is clearly suspicious.').lines, []);
  assert.equal(R.checkLookupAnswer('a\nb\nc\nd\ne\nf').lines.length, R.MAX_REPORT_LINES);
  assert.ok([...R.checkLookupAnswer('y'.repeat(500)).lines[0]].length <= R.MAX_REPORT_LINE_CHARS);
});

test("the computer's call strip names the records model, its time and tool calls", async () => {
  const { lineForLookup } = await import('../public/computer.js');
  assert.deepEqual(lineForLookup({ ms: 2340, tools: 3 }, { records: 'mistral-medium-3.5' }), { who: 'Records, Medium 3.5', what: 'searched the records in 2.34 s with 3 tool calls' });
  assert.equal(lineForLookup({ ms: 900, tools: 1 }, {}).what, 'searched the records in 0.90 s with 1 tool call');
});
