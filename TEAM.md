# Team plan

Shahil, Hamzah and Maleeka. The game is **Checkpoint** (`SPEC.md`): you question penguin travellers
out loud at an Antarctic border post and stamp them through or turned away.

## Roles

| Person | Main job | Also |
|---|---|---|
| Shahil | Owns `main` and is the only person who merges. Final say on scope. | Builds with his Claude Code build session. |
| Hamzah | Builds features. | Test lead: plays every feature as a real player and files bugs. |
| Maleeka | Builds features. | Pitch lead: the 3-minute pitch in `docs/PITCH.md`, and feedback from Mistral mentors. |

Swap the "Also" jobs if that suits you better.

## Building a feature

1. **Claim it first.** Open a GitHub issue named after the feature ("New traveller: the
   fishmonger"), or comment on an existing one, and assign yourself. One person per feature, so
   nobody builds the same thing twice. Free features are listed in `docs/checkpoint-plan.md`
   (rows marked `todo`).
2. **Get the latest:** `git switch main && git pull`
3. **Branch, named after the job:** `git switch -c feature/rule-card` (or `traveller/fishmonger`,
   `fix/stamp-sound`, `pitch/v1`)
4. **Build in small steps.** After each step, run `npm start` and play it, then
   `bash check.sh`. It must end with `ALL CHECKS PASSED`.
5. **Commit small and often:** `git add -A && git commit -m "Fishmonger: papers and story"`
6. **Push and open a pull request:** `git push -u origin HEAD`, then open the PR on GitHub (or
   `gh pr create --fill`). Fill in the template: what changed, the `check.sh` result, and a
   screenshot if it changes the screen.
7. **Shahil reviews and merges** at the next merge point. Delete the branch afterwards.

Using an AI agent (Claude Code, OpenCode, Mistral Vibe or another)? It reads `AGENTS.md`. Tell it
which feature and which files, and check its work by playing the game yourself. Its "done" is
not proof.

## Adding a traveller

Each traveller is one file in `src/travellers/`, so adding one doesn't clash with anyone.

1. Copy `src/travellers/colin.js` (honest) or `max.js` (lying) to `src/travellers/<id>.js`,
   and change everything in it: name, papers, truth, story prompt, voice and look. `bribe` is
   optional (ADR-13): give it, and his first TURNED AWAY brings out the line he says and the item
   he puts on the ledge; leave it out, and his first TURNED AWAY lands at once. The item is one of
   `BRIBE_ITEMS` in `src/rules.js`; a new one also needs drawing in `public/booth.js`.
2. Add one import line and their place in the queue in `src/travellers/index.js`.
3. `bash check.sh`: a test fails if the new traveller is missing a field or isn't in the index.
4. Play them with `npm start`: all 5 questions, twice, asking one question twice to see whether
   they keep their story straight. `npm run live-check` only covers Max and Colin so far; to
   cover yours, copy scenario (a) in `scripts/live-check.js` for your traveller.

## Who owns what (stops clashes)

| Files | Owner | Others |
|---|---|---|
| `src/rules.js`, `server/`, `public/` | Shahil (his build session edits these all day) | Say in your issue which of these you need to touch, before you start |
| A traveller you add | Whoever claimed it | Ask before changing someone else's traveller |
| `docs/PITCH.md`, `docs/FEEDBACK.md` | Pitch lead | |
| `docs/TESTING.md` | Test lead | |
| `SPEC.md`, `docs/DECISIONS.md` | Shahil | Suggest changes in an issue |

The key rules are in `AGENTS.md`: the API key lives only in `.env`, and `check.sh` passes before
every commit.

## The rest of the day

| Time | What |
|---|---|
| now | Set up (README), claim a feature, start a branch. |
| 14:30 | **Merge point 1.** Open PRs get merged; everyone plays the merged game. |
| 16:30 | **Merge point 2.** Last new feature. |
| 17:15 | **Feature freeze.** Bug fixes only. Rehearse the demo and pitch twice. |
| 17:50 | Submit. The hard stop is 18:00. |
| 19:00–21:00 | Pitches. |

PRs merge at the merge points, unless one fixes a bug that breaks the demo.

## Filing a bug

Title: what broke. Body: the steps, what you expected, what happened, and a screenshot. Use the
Issues tab on GitHub or `gh issue create`.
