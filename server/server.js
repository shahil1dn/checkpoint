// Local server. Run with `npm start`; binds to 127.0.0.1 only.
import http from 'node:http';
import { createApp } from './app.js';
import { describeError, hasApiKey, makeMistralAsker } from './mistral.js';

const PORT = Number(process.env.PORT) || 5173;
const live = hasApiKey();

const handle = await createApp({
  ask: live ? makeMistralAsker() : null,
  liveAvailable: live,
  log: (err) => console.error(describeError(err)),
});

http.createServer(handle).listen(PORT, '127.0.0.1', () => {
  console.log(`Checkpoint on http://localhost:${PORT} (Mistral key ${live ? 'found' : 'missing: add it to .env'})`);
});
