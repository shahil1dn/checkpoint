# Le Chonk solo build

Built at the Mistral Vibe Hackathon, London, 21 Nov 2026. The game, Checkpoint: `SPEC.md`.

## Setup

```bash
cp .env.example .env          # then paste your Mistral API key after MISTRAL_API_KEY=
python3 scripts/smoke.py      # proves the key works and lists the models
```

## Run

```bash
npm start            # the game on http://localhost:5173 (open it in Chrome)
npm test             # the rules, server and Mistral-call tests, no network
npm run live-check   # 3 real questions to Max: replies, moods, voice, timing
npm run rehearse     # timed demo shift in headless Chrome (needs npm start running)
```

`./check.sh` runs before every commit. How the agents work here: `AGENTS.md`, `CLAUDE.md`.
