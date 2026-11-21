// The inspector's computer: one line per real Mistral call, built only from
// the model's name, the call's timing and the player's own words. It imports
// nothing and never receives a traveller, so it can't show a truth, a secret
// or a prompt; the answer it's given is read for named fields only.

export const MAX_LINES = 9;

// 'mistral-medium-3.5' becomes 'Medium 3.5'; 'voxtral-mini-tts-3' becomes 'Voxtral Mini TTS 3'.
export function modelName(id) {
  if (!id) return 'Mistral';
  return id.split('-')
    .filter((word) => word !== 'mistral' && word !== 'latest')
    .map((word) => (word === 'tts' ? 'TTS' : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

const seconds = (ms) => `${(ms / 1000).toFixed(2)} s`;
const quote = (text) => `"${text.length > 56 ? `${text.slice(0, 55)}…` : text}"`;

export function lineForHeard({ text, ms }, models) {
  return { who: modelName(models?.hear), what: `heard ${quote(text)} in ${seconds(ms)}` };
}

export function lineForTyped(question) {
  return { who: 'Typed', what: quote(question) };
}

export function linesForAnswer(answer, travellerName, models) {
  const { timings, fallback, notes } = answer;
  const lines = [{
    who: modelName(models?.answer),
    what: `answered ${travellerName} in ${seconds(timings.answerMs)}${fallback ? ', asking you to repeat (not counted)' : ''}`,
  }];
  if (!fallback) {
    const count = notes?.length ?? 0;
    lines.push({
      who: `Note-taker, ${modelName(models?.notes)}`,
      what: count ? `added ${count === 1 ? 'a note' : `${count} notes`} in ${seconds(timings.notesMs)}` : `found nothing new in ${seconds(timings.notesMs)}`,
    });
  }
  return lines;
}

export function lineForSpeech(audioSeconds, speechMs, models) {
  return { who: modelName(models?.speech), what: `spoke ${audioSeconds.toFixed(1)} s of audio, made in ${seconds(speechMs)}` };
}
