// Local server. Run with `npm start`; binds to 127.0.0.1 only.
import http from 'node:http';
import { HEARING_HINTS } from '../src/travellers.js';
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

http.createServer(handle).listen(PORT, '127.0.0.1', () => {
  console.log(`Checkpoint on http://localhost:${PORT} (Mistral key ${live ? 'found' : 'missing: add it to .env'})`);
});
