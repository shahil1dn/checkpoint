# Le Chonk solo build

Built at the Mistral Vibe Hackathon, London, 21 Nov 2026. The game, Checkpoint: `SPEC.md`.

## Setup

```bash
cp .env.example .env          # then paste your Mistral API key after MISTRAL_API_KEY=
python3 scripts/smoke.py      # proves the key works and lists the models
```

`./check.sh` runs before every commit. How the agents work here: `AGENTS.md`, `CLAUDE.md`.
