// Checks what server/mistral.js sends, using a fake fetch: no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError, makeMistralAsker, makeMistralHearer, makeMistralSpeaker } from '../server/mistral.js';
import { buildMessages } from '../server/prompt.js';
import { getTraveller } from '../src/travellers.js';

const FAKE_KEY = 'test-key-must-not-leak';
const max = getTraveller('max');

function fakeFetch(status, json) {
  const sent = [];
  const impl = async (url, init) => {
    sent.push({ url, init });
    return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
  };
  return { impl, sent };
}

test('the asker sends the key only in the Authorization header, to Mistral', async () => {
  process.env.MISTRAL_API_KEY = FAKE_KEY;
  const { impl, sent } = fakeFetch(200, { choices: [{ message: { content: '{"reply":"hi"}' } }] });
  await makeMistralAsker({ fetchImpl: impl })({ traveller: max, history: [], question: 'Hello?' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.mistral.ai/v1/chat/completions');
  assert.equal(sent[0].init.headers.authorization, `Bearer ${FAKE_KEY}`);
  const body = JSON.parse(sent[0].init.body);
  assert.equal(body.model, 'mistral-medium-3.5');
  assert.equal(body.response_format.json_schema.strict, true);
  assert.ok(!sent[0].init.body.includes(FAKE_KEY));
});

test('a reply sent as parts keeps only the text parts', async () => {
  const content = [{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: '{"reply":"ok"}' }];
  const { impl } = fakeFetch(200, { choices: [{ message: { content } }] });
  const raw = await makeMistralAsker({ fetchImpl: impl })({ traveller: max, history: [], question: 'Hi' });
  assert.equal(raw, '{"reply":"ok"}');
});

test('a refused call throws an error that carries no key and no body', async () => {
  process.env.MISTRAL_API_KEY = FAKE_KEY;
  const { impl } = fakeFetch(401, { message: `bad key ${FAKE_KEY}` });
  const err = await makeMistralAsker({ fetchImpl: impl })({ traveller: max, history: [], question: 'Hi' }).catch((e) => e);
  assert.equal(err.status, 401);
  assert.ok(!describeError(err).includes(FAKE_KEY));
  assert.ok(!err.message.includes(FAKE_KEY));
  assert.ok(!err.message.includes('bad key'));
});

test('the hearer sends the clip as a webm file with the model and language', async () => {
  process.env.MISTRAL_API_KEY = FAKE_KEY;
  const { impl, sent } = fakeFetch(200, { text: 'Hello there' });
  const hear = makeMistralHearer({ hints: ['Mistral', 'Chonk'], fetchImpl: impl });
  const text = await hear({ audio: new Uint8Array([1, 2]), type: 'audio/webm' });
  assert.equal(text, 'Hello there');
  assert.equal(sent[0].url, 'https://api.mistral.ai/v1/audio/transcriptions');
  const form = sent[0].init.body;
  assert.equal(form.get('model'), 'voxtral-mini-latest');
  assert.equal(form.get('language'), 'en');
  assert.equal(form.get('file').name, 'question.webm');
  assert.equal(form.get('file').size, 2);
  assert.deepEqual(form.getAll('context_bias'), ['Mistral', 'Chonk']);
});

test('the speaker asks for mp3 in the given preset voice', async () => {
  const { impl, sent } = fakeFetch(200, { audio_data: 'QUJD' });
  const audio = await makeMistralSpeaker({ fetchImpl: impl })({ text: 'Bonjour', voiceId: 'v-1' });
  assert.equal(audio, 'QUJD');
  assert.equal(sent[0].url, 'https://api.mistral.ai/v1/audio/speech');
  assert.deepEqual(JSON.parse(sent[0].init.body), { model: 'voxtral-mini-tts-3', input: 'Bonjour', voice_id: 'v-1', response_format: 'mp3' });
});

test('a speech reply with no audio is an error, not a silent success', async () => {
  const { impl } = fakeFetch(200, {});
  await assert.rejects(makeMistralSpeaker({ fetchImpl: impl })({ text: 'Hi', voiceId: 'v' }));
});

test('the prompt carries the cover story, the secret and the papers', () => {
  const [system] = buildMessages(max, [], 'Hi');
  assert.match(system.content, /Mistral AI's biggest fan/);
  assert.match(system.content, /Frontier Horizon Labs, a rival AI lab/);
  assert.match(system.content, /Ticket sponsored by: Frontier Horizon Labs/);
});

test('past exchanges alternate inspector and traveller turns', () => {
  const msgs = buildMessages(max, [{ question: 'a', reply: 'b', mood: 'sad' }], 'c');
  assert.deepEqual(msgs.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
  assert.equal(JSON.parse(msgs[2].content).reply, 'b');
});
