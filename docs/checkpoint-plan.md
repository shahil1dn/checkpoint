# Checkpoint: build plan

From `SPEC.md`. A Claude Code build session builds each slice, runs `./check.sh` and plays it.
Ordered by dependency, then riskiest first. Tick each slice with its proof when it lands.
The detailed S1 brief (written for Vibe before it was dropped; ignore its Vibe-only lines):
`logs/vibe/20261121-102911/task.txt`.

Feature freeze 17:15. Rough budget: core (S1 to S6) by 15:00, look by 16:15, stretch after.

| # | Slice (one sentence) | Verify | Status |
|---|---|---|---|
| S1 | Type a question to the Mistral superfan and his real reply appears on the page. | `npm test` (bad requests never reach Mistral: A4; key never in a response: A6) + typed question in the browser shows a live reply (screenshot) | **done 10:58.** `npm test`: 24 pass, 0 fail (A4: 8 bad requests refused with the fake Mistral called 0 times; A6: no page file or API response contains the key). Mutation check: loosening the 5-question limit turns the 6th-question test red. Live: asked "What is the nickname of Mistral Large 4?", Max answered "Le Grand Fromage" [confident]: `docs/proof/s1-typed-reply.jpg` |
| S2 | Hold Space, ask out loud, and your words appear and get asked. Riskiest: is the browser's recording format accepted? | A8: a clip recorded by the page transcribes; spoken question in the browser gets a reply | todo |
| S3 | The superfan answers out loud in Paul's voice, which changes with his mood. | `npm test` (A5: bad mood, long reply, markdown cleaned) + reply plays aloud; `npm run live-check` round trip under 3 s (A7) | todo |
| S4 | Papers on the desk, a 5-question limit, and through / turned away stamps for a 2-traveller queue. | `npm test` (A1: 6th question refused) + screenshot of papers and a stamped traveller | todo |
| S5 | A shift clock that pauses while Mistral thinks, then an end-of-shift report scored from the stored truth. | `npm test` (A2: score ignores the model; A3: clock paused) + screenshot of the report | todo |
| S6 | Full demo dress rehearsal. | A9: timed run of the demo shift under 2 minutes, screen recording | todo |
| S7 | The setting and look (needs Shahil's call), then a vibe audit. | Screenshots at laptop and projector size; vibe-audit report | todo |
| S8 | Stretch: a judge's handwritten rule card is read by the webcam and changes the shift. | A10: photo of a card returns the rule word for word | todo |
| S9 | Stretch: Large 4 invents a traveller to order after the script picks his truth. | A new traveller plays a full interrogation; his truth matches what the script chose | todo |
