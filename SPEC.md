# Spec: Checkpoint (working title)

Living document for today's build. Decisions and their why: `docs/DECISIONS.md`. Ideas and the
reasons this one was chosen: `docs/IDEAS.md`.

## Target

A new browser game in this repo, built on the shape of `~/Documents/projects/fang-street-poc`:

| Part | File | Job |
|---|---|---|
| Rules | `src/rules.js` | Pure game logic: the queue, question limit, clock, verdicts, score. No network, no DOM. |
| Travellers | `src/travellers.js` | One entry per traveller: name, voice, papers, cover story, **truth**, tells. |
| Fake brain | `src/mockBrain.js` | Canned traveller replies, for tests and for playing without the internet. |
| Mistral calls | `server/mistral.js` | Chat (traveller replies), transcription, speech, OCR. The only file that reads the key. |
| Server | `server/app.js`, `server/server.js` | Serves the page; `/api/hear`, `/api/ask`, `/api/speak`, `/api/rule-card`. |
| Page | `public/index.html`, `public/app.js`, `public/style.css` | The inspector's desk. |
| Tests | `test/*.test.js` | `node --test`, run by `./check.sh`. |
| Live check | `scripts/live-check.js` | Plays a scripted interrogation against real Mistral and checks the replies. |

## Objective

You're the inspector at a checkpoint. Travellers step up one at a time with papers on your desk.
You question them **out loud**; they answer **out loud**, each in their own voice, and they
flatter you and dodge. When you're sure, you stamp them **through** or **turned
away**; reach for turned away and they try one last bribe first (ADR-13). At the end of the
shift the game reveals who was lying and scores you. The first
traveller is a Mistral superfan, so a room of Mistral judges can catch him out with what they know.

## In scope

1. **The queue.** A shift is a fixed list of travellers. Demo shift: the Mistral superfan, then
   one more.
2. **Papers.** Each traveller's documents appear on the desk as on-screen cards (name, origin,
   occupation, purpose of visit, and so on). Some details on a liar's papers contradict his story.
3. **Asking by voice.** Hold Space (or a button) to talk, let go to send. The page records the
   clip; the server sends it to Voxtral and gets the words back. Typing a question also works,
   as a backup if the microphone fails.
4. **Answering by voice.** The traveller's reply comes from `mistral-medium-3.5` as JSON
   (`reply`, `mood`, `cracked`), then Voxtral TTS speaks it in that traveller's voice. The reply
   text also shows on screen.
5. **The tell.** A traveller voiced by "Paul" switches between Paul's mood voices (confident,
   neutral, happy, frustrated, sad, excited) as the reply's `mood` changes. Others keep one voice
   and show their mood on screen.
6. **The truth belongs to the game.** Each traveller's truth (honest, or what he's hiding) is in
   `src/travellers.js` before the shift starts. The model is told it and plays the part, but it
   never decides it. The score compares the player's stamp with that stored truth, in
   `src/rules.js`.
7. **Pressure.** At most 5 questions per traveller. A shift clock (starting value 2 minutes)
   that pauses while waiting for Mistral, so a slow connection never costs the player time.
   The shift ends when the queue is empty or the clock runs out.
8. **Stamping.** Two buttons: through, or turned away. Allowed at any time, even before the first question.
9. **End of shift.** A report: each traveller, your stamp, the truth, and right or wrong.
10. **The Mistral superfan.** Voiced by Paul. Proposed truth: he's really a spy from an unnamed
    rival AI lab. He flatters, overclaims and gets Mistral facts wrong under pressure (tested at
    10:20: asked Large 4's nickname, he guessed "Mixtral" instead of "Le Chonk").

**The scratchpad (Shahil, 10:55).** Beside the papers, each traveller gets a page of notes the game
writes for the player as the questioning goes on. It records what was said and seen, and where two
things don't line up: an answer against the papers, an answer against an earlier answer, a dodge,
a change in manner ("went quiet when asked who paid"). It **never gives a verdict**: no ticks or
crosses, no "lie", "truth", "suspicious" or "honest". The player still has to ask the right
questions and work it out. Honest travellers get notes too, including odd-but-innocent details,
so a note is never proof by itself.
- The notes come from a second Mistral call after each answer, run alongside the speech so it
  adds no wait. Start with `mistral-medium-3.5`.
- **The note-taker sees only what the player sees**: the papers and the conversation. Never the
  traveller's prompt, truth or secret, so the notes can't give the answer away (ADR-8).
- The code checks every note before showing it: verdict words are refused, and each note is at
  most 2 a turn and 120 characters.
- The mood label (`[confident]`) comes off the screen. Mood shows only through the voice, and
  later the penguin's face; changes of manner can appear in the notes as observations.

**The booth, seen through the inspector's eyes (Shahil, 11:07).** The page becomes a 3D scene from
the player's point of view, sitting in the booth. The window is in front, with the penguin
traveller standing beyond it; the desk is below it, with the tools on it. The camera doesn't move,
and there's no walking.
- **Point and click.** Every tool is an object on the desk. Hovering lights it up and changes the
  cursor; clicking uses it. Works with a laptop trackpad.
  - **Papers:** click to lift them close and read them; click again to put them down.
  - **Scratchpad:** a notebook; click to open or close it. The notes appear in it as handwriting.
  - **Microphone:** click and hold to ask a question. Holding Space still works too.
  - **Two rubber stamps**, through and turned away: click one to stamp the papers. The traveller
    reacts and leaves, and the next one steps up.
- **The traveller** is a Fang Street penguin (ADR-6). His face follows `mood`, and he turns to
  face you while talking.
- ~~Subtitles~~ **Transcript on paper (Shahil, 13:40):** instead of subtitle boxes, the
  conversation prints onto a paper transcript slip on the desk, both what the player said and
  the reply, line by line as it happens. The newest lines must be readable at 1440 wide without
  clicking, because the pitch room will be loud; click the slip to lift it and read the whole
  conversation. It's in our own paper style, like the travel papers, and imitates no game.
- **No on-screen buttons (Shahil, 13:40).** The row of HTML buttons (hold to talk, papers,
  scratchpad, stamps) is removed: everything is done by clicking objects on the desk. Keyboard
  shortcuts stay (Space to talk, P papers, N scratchpad, ← → to turn). The small "type a
  question" box stays as the backup for a failed microphone, sent with Enter.
- **One message at a time.** Hints never stack: at most one status hint is shown, in one fixed
  place, and hover labels appear next to the object under the cursor.
- **Look:** the penguin art direction (`system-design-lab/docs/ART-DIRECTION.md` section 3) and
  the Fang Street room and palette helpers (`fang-street-mvp/src/penguins/engine.js`). It's our
  own look, with nothing drawn from any existing game. Where the checkpoint stands is still open
  (S7), so the booth stays plain until then.
- Everything that already works must keep working: the shift clock, question limit, scoring,
  scratchpad, `npm test` and A6, and the demo still under 2 minutes.

**Looking around the booth (Shahil, 13:28).**
- **Better framing at the window.** The camera sits at the traveller's eye level, so it feels
  face to face. His whole head and upper body are in view with a little room above; the desk
  tools are still easy to see and click. **Shahil picked option B (13:40):** a step back with a
  50° lens, so the traveller is bigger in the window; the edge signs may be cropped.
- **Three views you turn between:** left, window (where you start) and right. Arrows at the
  screen edges, or the ← and → keys, turn the camera smoothly. Questions, subtitles and the
  shift clock keep working in every view, and stamping happens at the window.
- **Left: the inspector's computer**, with a live screen of the real Mistral models at work, fed
  by the game's actual calls: Voxtral heard "…", Medium 3.5 answered in 0.5 s, the note-taker
  added a note, Voxtral spoke 4.1 s of audio. Model names in plain text; no copied logos.
  It's for flavour, and it shows the judges what Mistral is doing.
- **Right: funny stuff and paperwork:** in-world joke props and a pile of forms (a staff notice
  board, a "rival lab" bulletin, a sardine-tin pen pot, a mug). Flavour only: nothing on it
  gives away who's lying. Stretch item 11's rule card would be pinned here.

**The records terminal (Shahil, 15:05).** The left computer becomes a working records terminal.
The demo is now 5 minutes, and this is what makes it intriguing: the AI reads at machine speed,
but only the player hears the lie.
- **Why an AI and not checking by hand:** the border's records are far too big and messy to
  read during a 5-question interview. That means ship passenger lists for today's arrivals, a
  penguin registry, a company register and a long rulebook, with misspelled names ("M.
  Tokkens"), mixed date formats and gaps. The terminal finds near matches, follows them across
  lists, and quotes the rulebook.
- **It can only check what the player has gathered.** No free typing. The player clicks a line
  on the papers ("Ticket sponsored by: Frontier Horizon Labs") or on the transcript ("I came on
  the 10:16 from Cape Town") to look it up. The server refuses any lookup that isn't a real
  line from that traveller's papers or conversation. Asking the traveller the right questions is
  how the player gets more worth checking.
- **3 lookups per traveller**, counted by the code. Spending them is the player's strategy.
- **It reports records, never a verdict.** It gets the records and the line, and never the
  traveller's prompt, truth or secret (ADR-12). It never hears the interview unless the player
  sends a line, and it doesn't say who's lying; the same verdict-word filter as the scratchpad
  applies. Things only the player can catch: what was said against what the records show, the
  voice and face, whether the story makes sense, and anything never looked up.
- **The records are written in the code, per traveller,** before the shift (in their own
  files, not the traveller files). A liar's records have gaps his story has to cover. An honest
  traveller's records are messy but consistent, so a typo never proves anything. Plus a few
  hundred background entries, so the search is real.
- **Harder papers:** each traveller gets a second document (a ship ticket) with details to
  check against the records.
- **On screen:** the terminal shows its steps as it works ("searching passenger lists… 3 near
  matches… reading rulebook §4"), then the answer quoting the records. This is the place for
  Large 4: a pause is fine at a terminal, and it shows the judges Mistral's tool use.

**Stretch, only once 1 to 10 work end to end:**

11. **Today's rule card.** Before the shift, a judge handwrites a rule on paper ("nobody
    carrying fruit") and holds it to the webcam. `mistral-ocr-4` reads it, the rule shows on the
    desk, and it's added to every traveller's instructions for that shift.
12. **Travellers made to order.** The script picks a new traveller's truth first. Then Large 4
    writes the character, papers and voice choice to fit, so the queue can be different every time.

## Out of scope

- The place the checkpoint stands in and the final name. These wait on Shahil (see open questions).
  **Decided 10:42: the travellers are penguins.** They use the code-drawn Three.js penguin cast
  from `~/Documents/projects/fang-street-mvp/src/penguins/` and `src/cast.js`, built to the art
  direction in `~/Documents/projects/system-design-lab/docs/ART-DIRECTION.md` (section 3). Their
  faces change with `mood`, so the tell can be seen as well as heard.
- Saving anything: no accounts, no high scores, no saved games. Audio clips and transcripts live
  only in memory for the current shift and are never written to disk or logged.
- Copying a player's voice. The API supports it, but it isn't part of this game.
- Live streaming transcription. Hold-to-talk with one clip per question is simpler and measured
  at about 0.5 s (see `docs/DECISIONS.md`).
- Guarding against players who trick a traveller into confessing. That's just good interrogation.
  It can't change the score, because the score never asks the model.
- Phones, multiple players, other languages. The demo runs on this laptop in English.
- Any look based on an existing game: we borrow the idea of a checkpoint, nothing else.

## Constraints

- From `AGENTS.md`: the key lives only in `.env`, and only `server/mistral.js` reads it. The page
  only ever talks to our server. `./check.sh` passes before every commit. Each change leaves the
  demo working. No new dependency without a reason.
- No dependencies at all: Node 25 has `fetch` built in, so `server/mistral.js` calls the Mistral
  REST API directly instead of using an SDK.
- Everything a model sends back is untrusted. The server checks the reply against the schema.
  If `mood` isn't on the list, it becomes `neutral`. A reply longer than 300 characters is cut,
  and markdown (`*`, `_`) is stripped before speaking.
- Requests are checked before any Mistral call: body size, question length (1 to 300
  characters), a known traveller id, and the question count still under the limit.
- Large 4 replies arrive as a list of parts (thinking first, then text); read only the `text`
  parts, and give `max_tokens` room for the thinking. This matters for stretch item 12 only.
- Code is written by Claude Code, one slice at a time. Mistral is the product's AI and voice
  layer only.
- Times: feature freeze 17:15, submitted by 17:50. The demo must run in under 2 minutes.

## Acceptance criteria

Each line names a check that can fail.

| # | Behaviour | Proof |
|---|---|---|
| A1 | The 6th question to one traveller is refused and costs nothing | `npm test`: a rules test asks 6 and expects the 6th refused, with the count still 5 |
| A2 | The score uses the stored truth, never the model | `npm test`: stamping a liar "through" scores wrong, even when the mock brain's reply says `cracked: false` |
| A3 | The clock doesn't run while waiting for Mistral | `npm test`: start waiting, advance time 10 s, finish waiting: shift time used is unchanged |
| A4 | A bad request never reaches Mistral | `npm test`: the server test sends an empty, oversized or 6th question and checks the injected fake Mistral was called 0 times |
| A5 | A broken model reply can't break the game | `npm test`: a reply with mood `furious`, 900 characters and `**bold**` comes out as `neutral`, 300 characters and plain text |
| A6 | The key never reaches the browser | `npm test`: fetch every static file and API response from a test server with a fake key set; none contains it. Plus `./check.sh` step 1 |
| A7 | The real traveller replies in time and in shape | `npm run live-check`: 3 scripted questions to the superfan; every reply parses, `mood` is on the list, and each round trip (reply plus speech) is under 3 s. The output is saved to `docs/live-check/` |
| A8 | A clip recorded in the browser transcribes | Live check: a webm clip saved from the page's recorder comes back as text containing the words spoken |
| A9 | The whole demo fits | A timed run of the demo shift (superfan plus one more), start to end-of-shift report, under 2 minutes. Proof: the screen recording with its timestamp |
| A11 | The note-taker never sees the secret | `npm test`: with an injected fake fetch, the note-taker's request contains the papers and the conversation, and contains neither the traveller's prompt nor his truth or secret |
| A12 | Notes never give a verdict | `npm test`: notes containing "lie", "liar", "lying", "truth", "honest", "suspicious", "guilty", "innocent", "✓" or "✗" are refused, and so are a 3rd note in one turn or a note over 120 characters. Live check: no refused notes across 3 runs of each traveller |
| A13 | The notes catch a real mismatch | Live check: when Max is asked who paid for his ticket, the notes point out the clash with "Ticket sponsored by: Frontier Horizon Labs" in at least 2 of 3 runs |
| A10 | Stretch 11: the rule card reads | Live check: a photo of a handwritten card returns the written rule, word for word |

## Open questions for Shahil

1. ~~Where the checkpoint is.~~ **Decided 12:06: the border post into Antarctica** (ADR-11,
   replacing ADR-10's train border). Penguin travellers step off a ship; a police penguin
   snatches away anyone turned away.
2. **The superfan's secret.** Proposed: a spy from a rival lab who gets Mistral facts wrong.
   Keep it, or make him an honest superfan, so the twist is that being over the top isn't lying?
3. **The other travellers.** Hand-written ones decided later, or stretch item 12, where Large 4
   invents them to order?
