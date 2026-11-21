The shared rules for this folder are in `AGENTS.md`:

@AGENTS.md

## How Claude Code works here

Teammates using Claude Code: follow `TEAM.md`. The rest of this section is about Shahil's setup.

Shahil directs; a Claude Code build session writes the code, one slice of
`docs/checkpoint-plan.md` at a time. Mistral is the product's AI and voice layer only.
Vibe was dropped on 21 Nov at 10:30; `scripts/vibe.sh` and `logs/vibe/` are left as they are.

- **After every slice:** run `./check.sh` and play the app, then tick the slice in
  `docs/checkpoint-plan.md` with its proof.
- **Spend:** report Mistral API usage at each check-in if it becomes noticeable; the voice and
  chat calls tested on 21 Nov cost cents.
