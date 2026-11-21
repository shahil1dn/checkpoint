// Local server. Run with `npm start`; binds to 127.0.0.1 only.
import http from 'node:http';
import { HEARING_HINTS } from '../src/travellers/index.js';
import { createApp } from './app.js';
import { describeError, hasApiKey, makeMistralAsker, makeMistralHearer, makeMistralNoteTaker, makeMistralSpeaker } from './mistral.js';

const PORT = Number(process.env.PORT) || 5173;
const live = hasApiKey();

const handle = await createApp({
  ask: live ? makeMistralAsker() : null,
  hear: live ? makeMistralHearer({ hints: HEARING_HINTS }) : null,
  speak: live ? makeMistralSpeaker() : null,
  takeNotes: live ? makeMistralNoteTaker() : null,
  liveAvailable: live,
  log: (err) => console.error(describeError(err)),
});

// On Windows, Notepad can put an invisible mark at the very start of .env,
// which hides a key on the first line from Node; a comment line first avoids it.
const NO_KEY = [
  'No Mistral key found, so travellers give canned replies and no voices. Check that:',
  '  - .env exists in this folder (copy .env.example to .env);',
  '  - the key comes straight after MISTRAL_API_KEY= with no quotes;',
  "  - .env still starts with its comment lines: don't delete them.",
].join('\n');

http.createServer(handle).listen(PORT, '127.0.0.1', () => {
  console.log(`Checkpoint on http://localhost:${PORT}`);
  console.log(live ? 'Mistral key found.' : NO_KEY);
});
