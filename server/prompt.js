// What the traveller model is told. Pure, so tests can read the exact prompt.
import { MOODS } from '../src/rules.js';

export const REPLY_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'reply',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'mood', 'cracked'],
      properties: {
        reply: { type: 'string' },
        mood: { type: 'string', enum: MOODS },
        cracked: { type: 'boolean' },
      },
    },
  },
};

// The papers are added so the model's story matches what the inspector sees.
export function buildSystemPrompt(traveller) {
  const papers = Object.entries(traveller.papers).map(([k, v]) => `${k}: ${v}`).join('; ');
  return `${traveller.prompt}\n\nYour papers, which the inspector can see: ${papers}.`;
}

export function buildMessages(traveller, history, question) {
  const messages = [{ role: 'system', content: buildSystemPrompt(traveller) }];
  for (const past of history) {
    messages.push({ role: 'user', content: past.question });
    messages.push({ role: 'assistant', content: JSON.stringify({ reply: past.reply, mood: past.mood, cracked: false }) });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}
