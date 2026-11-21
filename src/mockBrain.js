// Canned traveller replies, for tests and for playing with no internet.
// Returns the same raw JSON text shape the real model sends.
const LINES = {
  max: [
    { reply: 'Inspector! What a magnificent hat. I am here for the Mistral hackathon, naturally.', mood: 'excited' },
    { reply: 'Mistral facts? I know them all. Would you like a sticker? Or a croissant?', mood: 'confident' },
    { reply: 'Frontier who? Never heard of them. Probably a typo on the ticket.', mood: 'frustrated' },
  ],
  colin: [
    { reply: 'Cheese. Forty kilos of it, for the hackathon lunch. Same as Tuesday.', mood: 'neutral' },
    { reply: 'Yes, Stilton is my real name. Yes, I am from Stilton. Taste?', mood: 'frustrated' },
  ],
};

export function mockReply({ travellerId, history }) {
  const lines = LINES[travellerId] ?? [{ reply: 'Just passing through.', mood: 'neutral' }];
  const line = lines[Math.min(history.length, lines.length - 1)];
  return JSON.stringify({ ...line, cracked: false });
}
