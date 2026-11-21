# Decisions

One section per decision: what was decided, why, and what was turned down.

## ADR-1: Reuse Fang Street's shape, not its code wholesale (21 Nov)

**Decided:** copy the structure of `~/Documents/projects/fang-street-poc`: pure rules shared by
page and server, a small Node server that holds the key, a fake brain for tests, every model reply
treated as untrusted. The rules themselves are new, because this game is questioning rather than
persuading.
**Why:** that structure already proved itself with 72 tests and a mutation check. Rewriting it
would cost the morning.
**Turned down:** forking the Fang Street repo as-is. Its rules are about trust meters and doors,
and most would be deleted.

## ADR-2: The game owns the truth; the model only acts (21 Nov)

**Decided:** each traveller's truth is stored in `src/travellers.js` before the shift. The model is
told it so it can play the part, and the score compares the player's stamp with the stored truth.
**Why:** if the model decided at the end whether it had been lying, it could change its mind
mid-game, and the score would be whatever it said. The same split as halflife: the agent acts, a
script judges.
**Turned down:** asking the model "were you lying?" at the end.

## ADR-3: Hold-to-talk with one clip per question, not live streaming (21 Nov)

**Decided:** the page records a clip while Space is held; the server sends it to Voxtral's
transcription endpoint.
**Why:** measured at 0.47 s for a 4-second clip. Live streaming needs a WebSocket bridge through
our server (the key can't go to the browser) and hasn't been tested. Hold-to-talk also gives the
player a clear "I'm asking now" moment.
**Turned down:** `voxtral-mini-transcribe-realtime`; reconsider only if clip transcription feels slow.

## ADR-4: Traveller replies from `mistral-medium-3.5` (21 Nov)

**Decided:** live replies use `mistral-medium-3.5` with a JSON schema response.
**Why:** measured at 10:20 on the same question: Medium 3.5 0.52 s, Ministral 8B 1.09 s, Ministral
14B 1.31 s, all returning valid JSON. Large 4 thinks before every answer, too slow for speech
back and forth. It's kept for work where a pause is fine (stretch item 12).
**Turned down:** Large 4 for replies; Ministral, which was slower here, not faster.

## ADR-6: The travellers are the Fang Street penguin cast (21 Nov 10:42)

**Decided:** reuse the code-drawn Three.js penguins from `fang-street-mvp/src/penguins/` and
`src/cast.js` (about 1,500 lines: faces with expressions, outfits, speech bubbles). This brings
in the game's first dependencies, `three` and `vite`, the versions fang-street-mvp already uses.
**Why:** Shahil's call. A face that reacts to `mood` makes the tell visible, and the cast is
already built and art-directed. Moving the page onto Vite early (before S4 builds more page
code) avoids a rewrite at S7.
**Turned down:** drawing new characters, or keeping the page dependency-free.

## ADR-5: No SDK, plain `fetch` (21 Nov)

**Decided:** `server/mistral.js` calls the REST endpoints directly.
**Why:** Node 25 has `fetch` built in, and we need four endpoints, all already tried with curl
this morning. An SDK would be the project's first dependency, for no gain.

## ADR-7: Load `three` with an import map, not Vite (21 Nov 10:47)

**Decided:** keep the page as plain ES modules served by our own server. When the penguins arrive
(S7), add `three@0.186.1` (the version fang-street-mvp uses) and one `<script type="importmap">`
mapping `three` and `three/addons/` to files our server serves from `node_modules/three`.
Amends ADR-6, which planned a move to Vite before S4.
**Why:** the penguin code (`cast.js`, `penguins/*.js`, 1,611 lines) imports only `three` and
`three/addons/...`, and an import map with exactly those two entries is three.js's own documented
no-build setup (checked in the r186 docs). So S7 needs no rewrite of the page, while moving to
Vite now would add a build step, a second server path, and re-proving the static-file whitelist
and the key test (A6) on top of it.
**Turned down:** Vite (ADR-6's plan); loading three from a CDN, which the demo can't rely on if
the venue wifi drops.

## ADR-8: The scratchpad's note-taker sees only what the player sees (21 Nov 10:55)

**Decided:** the notes are written by a separate Mistral call that gets the papers and the
conversation, and nothing else: no traveller prompt, no truth, no secret. The code refuses any
note with a verdict word.
**Why:** Shahil wants observations, not answers: the player deduces. A note-taker that knew the
secret would leak it sooner or later, however it was told to behave. One that doesn't know it
can't. It's the Fang Street lesson again: the code guarantees what matters, and the prompt only
shapes the style.
**Turned down:** notes written by the traveller's own call (it knows the secret); notes built
purely by code from fixed fields (they'd miss dodges and changes of manner).
