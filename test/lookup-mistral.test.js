// The records terminal's Mistral calls, with an injected fake fetch (as A11
// does for the note-taker): every request holds only the records and the
// gathered line, never a traveller's prompt, truth or secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOKUP_MODEL, makeMistralLookup } from '../server/mistral.js';
import { TRAVELLERS } from '../src/travellers/index.js';
import { ARCHIVE } from '../src/records/archive.js';

process.env.MISTRAL_API_KEY = 'test-key-must-not-leak';

// Replies in order: a round of tool calls, then the report as Large 4 sends
// it, a thinking part and a text part.
function scriptedFetch(replies) {
  const sent = [];
  const impl = async (url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: replies.shift() }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { impl, sent };
}
const toolRound = (...calls) => ({
  role: 'assistant',
  content: '',
  tool_calls: calls.map(([name, args], i) => ({ id: `call${i}`, type: 'function', function: { name, arguments: JSON.stringify(args) } })),
});
const REPORT = { role: 'assistant', content: [{ type: 'thinking', thinking: [{ type: 'text', text: 'Hmm.' }] }, { type: 'text', text: 'Company register: Frontier Horizon Labs, AI research lab.' }] };

test('the model asks for tools, the code runs them over the records and reports each step', async () => {
  const { impl, sent } = scriptedFetch([
    toolRound(['find_company', { name: 'Frontier Horizon Labs' }], ['search_passenger_lists', { ticket_or_account: 'FHL-0042' }]),
    REPORT,
  ]);
  const steps = [];
  const report = await makeMistralLookup({ fetchImpl: impl })({ line: 'Ticket sponsored by: Frontier Horizon Labs', source: 'papers', onStep: (s) => steps.push(s.step) });
  assert.equal(report, 'Company register: Frontier Horizon Labs, AI research lab.');
  assert.equal(sent.length, 2);
  assert.equal(sent[0].model, LOOKUP_MODEL);
  assert.deepEqual(sent[0].tools.map((t) => t.function.name), ['search_passenger_lists', 'find_person', 'find_company', 'read_rulebook']);
  assert.deepEqual(steps, [
    `company register (${ARCHIVE.companies.length}): "Frontier Horizon Labs"… 1 exact match`,
    `passenger lists (${ARCHIVE.passengers.length}): "FHL-0042"… 1 exact match`,
  ]);
  // The second call carries the tool results, each tied to its call.
  const toolMessages = sent[1].messages.filter((m) => m.role === 'tool');
  assert.deepEqual(toolMessages.map((m) => [m.tool_call_id, m.name]), [['call0', 'find_company'], ['call1', 'search_passenger_lists']]);
  assert.match(toolMessages[0].content, /competition with Mistral AI/);
  assert.match(toolMessages[1].content, /M\. Tokkens/);
});

test('after 3 rounds of tools the terminal must write its report', async () => {
  const again = () => toolRound(['find_person', { name: 'Max Tokens' }]);
  const { impl, sent } = scriptedFetch([again(), again(), again(), REPORT]);
  await makeMistralLookup({ fetchImpl: impl })({ line: 'Name: Max Tokens', source: 'papers' });
  assert.equal(sent.length, 4);
  assert.deepEqual(sent.map((b) => b.tool_choice), ['auto', 'auto', 'auto', 'none']);
});

test('a broken or unknown tool call is answered, not thrown', async () => {
  const broken = { role: 'assistant', content: '', tool_calls: [{ id: 'x', function: { name: 'drop_tables', arguments: '{not json' } }] };
  const { impl, sent } = scriptedFetch([broken, REPORT]);
  await makeMistralLookup({ fetchImpl: impl })({ line: 'Name: Max Tokens', source: 'papers' });
  assert.match(sent[1].messages.at(-1).content, /no tool called drop_tables/);
});

for (const t of TRAVELLERS) {
  test(`${t.id}: no lookup request ever holds his prompt, truth or secret`, async () => {
    const lines = [...Object.entries(t.papers).map(([k, v]) => `${k}: ${v}`), ...(t.offlineLines ?? []).map((l) => l.reply)];
    for (const line of lines) {
      const { impl, sent } = scriptedFetch([
        toolRound(['find_person', { name: t.name }], ['find_company', { name: line }], ['search_passenger_lists', { name: t.name }], ['read_rulebook', { topic: line }]),
        REPORT,
      ]);
      await makeMistralLookup({ fetchImpl: impl })({ line, source: 'papers', name: t.papers.Name });
      const everything = JSON.stringify(sent);
      assert.ok(everything.includes(line.replace(/"/g, '\\"').replace(/[<>]/g, '')), 'the line is sent');
      assert.ok(!everything.includes(t.truth.secret), 'secret leaked');
      for (let i = 0; i + 40 <= t.prompt.length; i += 20) assert.ok(!everything.includes(t.prompt.slice(i, i + 40)), 'prompt leaked');
      assert.doesNotMatch(everything, /"honest"|\bspy\b/i);
    }
  });
}
