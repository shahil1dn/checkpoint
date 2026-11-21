# Le Chonk hackathon — solo build

Shared rules for every agent in this folder. Claude Code imports it from `CLAUDE.md`. One owner:
change a rule here, nowhere else.

## The event

Mistral Vibe Hackathon, London, Sat 21 Nov 2026. Open track. **Judged on creativity.**
Judges prefer projects built with Mistral's own tools, so the product's AI and voice run on the
Mistral API. Shahil's build is written by Claude Code (his call, 21 Nov 10:30). Teammates may use
any agent; these rules apply to all of them.

| Time | What |
|---|---|
| 10:00–18:00 | Hacking. **18:00 is a hard stop.** |
| 17:15 | Feature freeze: only fixes to the demo after this |
| 17:50 | Submitted, demo rehearsed |
| 19:00–21:00 | Pitches |

## The product

- The game is **Checkpoint**: you question lying AI travellers out loud and stamp them through
  or away. What to build: `SPEC.md`. Slices: `docs/checkpoint-plan.md`. Why: `docs/DECISIONS.md`.
- Its AI and voice are Mistral models called through the API; `scripts/smoke.py` lists which
  models the key can use.
- **Voice facts (checked 21 Nov):** speech out is `POST /v1/audio/speech` with model
  `voxtral-mini-tts-3` and a preset `voice_id`. Other TTS model names refuse preset voices
  ("voice is not supported for speech v1"). The reply is JSON `{audio_data: <base64>}`. Preset
  voices: `GET /v1/audio/voices`. Speech in is `POST /v1/audio/transcriptions`, multipart,
  `model=voxtral-mini-latest` plus `file`: mp3 and the browser's webm both work (checked 21 Nov).
- **Large 4 always reasons before answering** (checked 21 Nov). `reasoning_effort` takes `low`,
  `medium` or `high`; `none` is refused. Its `message.content` is a **list of parts**, a
  `thinking` part then a `text` part: read the answer from the `text` parts only. Give
  `max_tokens` room for the thinking too, or the reply is cut off before the answer.
- Creativity is the bar. A surprising, demoable idea beats a polished, ordinary one.
- The demo slot is **5 minutes** (Shahil, 21 Nov 15:00; it was 2), run on this laptop. The game
  part must leave room to explain it.

## Rules

- **The API key lives only in `.env`** (`MISTRAL_API_KEY=`). Never print it, log it, commit it,
  or put it in code sent to a browser. A browser page calls our own server, which calls Mistral.
- `./check.sh` must pass before every commit (on Windows: `bash check.sh`). It blocks a leaked
  key and failing tests.
- **Team work (Hamzah, Maleeka):** never push to `main`. Work on a branch and open a pull
  request; Shahil merges. Claiming features, branch names and who owns which files: `TEAM.md`.
- Small steps. Each change leaves the demo working; if it breaks, fix it before the next feature.
- No new dependency without a reason it's needed; prefer what's already installed.
- Plain names, short functions, comments only for *why*.
