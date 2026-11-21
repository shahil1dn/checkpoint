// Every traveller in the game, in shift order. Each one lives in its own file
// here, so adding a traveller is a new file plus one line below. The truth is
// fixed in those files before a shift starts (ADR-2): the model is told it so
// it can act, but the score reads it from there.
import max from './max.js';
import colin from './colin.js';

export const TRAVELLERS = [max, colin];

export const TRAVELLER_IDS = TRAVELLERS.map((t) => t.id);

// Words the inspector is likely to say that speech-to-text gets wrong
// ("Large 4" came back as "Lodge 4"), plus each traveller's own. Single words:
// Voxtral writes a multi-word hint back with underscores in it.
const GAME_WORDS = [
  'Mistral', 'Large', 'Medium', 'Mixtral', 'Ministral', 'Codestral', 'Voxtral', 'Magistral',
  'Chonk', 'Le', 'hackathon',
];
export const HEARING_HINTS = [...GAME_WORDS, ...TRAVELLERS.flatMap((t) => t.hearingHints ?? [])];

export function getTraveller(id) {
  return TRAVELLERS.find((t) => t.id === id) ?? null;
}

// A traveller with mood voices sounds different as his mood changes;
// anyone else always speaks in his one voice.
export function voiceFor(traveller, mood) {
  if (traveller.voices) return traveller.voices[mood] ?? traveller.voices.neutral;
  return traveller.voice;
}
