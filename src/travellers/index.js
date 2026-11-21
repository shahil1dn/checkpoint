// Every traveller in the game. Each one lives in its own file
// here, so adding a traveller is a new file plus one line below. The truth is
// fixed in those files before a shift starts (ADR-2): the model is told it so
// it can act, but the score reads it from there.
import max from './max.js';
import colin from './colin.js';
import rupert from './rupert.js';
import pebble from './pebble.js';

export const TRAVELLERS = [max, colin, rupert, pebble];

export const TRAVELLER_IDS = TRAVELLERS.map((t) => t.id);

// Who steps up in a shift, in order (Shahil 15:25). Colin sits this one out.
export const QUEUE = ['max', 'rupert', 'pebble'];

// Who joins the back of the queue once the shift is under way (Hamzah 17:30):
// Colin, then one traveller invented for that shift (plan row S9), if Large 4
// writes him in time. The first three are the rehearsed demo.
export const LATE_ARRIVALS = ['colin'];

// Words the inspector is likely to say that speech-to-text gets wrong
// ("Large 4" came back as "Lodge 4"), plus each traveller's own. Single words:
// Voxtral writes a multi-word hint back with underscores in it.
const GAME_WORDS = [
  'Mistral', 'Large', 'Medium', 'Mixtral', 'Ministral', 'Codestral', 'Voxtral', 'Magistral',
  'Chonk', 'Le', 'hackathon',
];
export const HEARING_HINTS = [...GAME_WORDS, ...TRAVELLERS.flatMap((t) => t.hearingHints ?? [])];

// Travellers invented during a shift (plan row S9, server/invent.js). They
// have no file: the server registers each one it makes, and so does the page
// when it is handed him. Only the newest few are kept.
const GUESTS = new Map();
const MAX_GUESTS = 20;
export const isGuest = (id) => GUESTS.has(id);
export function registerTraveller(traveller) {
  GUESTS.set(traveller.id, traveller);
  while (GUESTS.size > MAX_GUESTS) GUESTS.delete(GUESTS.keys().next().value);
  return traveller;
}

export function getTraveller(id) {
  return TRAVELLERS.find((t) => t.id === id) ?? GUESTS.get(id) ?? null;
}

// A traveller with mood voices sounds different as his mood changes;
// anyone else always speaks in his one voice.
export function voiceFor(traveller, mood) {
  if (traveller.voices) return traveller.voices[mood] ?? traveller.voices.neutral;
  return traveller.voice;
}
