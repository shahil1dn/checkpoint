// Canned traveller replies, for tests and for playing with no internet: each
// traveller's offlineLines, in order. Returns the same raw JSON text shape
// the real model sends.
import { getTraveller } from './travellers/index.js';

export function mockReply({ travellerId, history }) {
  const lines = getTraveller(travellerId)?.offlineLines ?? [{ reply: 'Just passing through.', mood: 'neutral' }];
  const line = lines[Math.min(history.length, lines.length - 1)];
  return JSON.stringify({ bribe: false, ...line, cracked: false });
}
