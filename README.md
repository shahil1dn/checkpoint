# Checkpoint

Built at the Mistral Vibe Hackathon, London, 21 Nov 2026, by Shahil, Hamzah and Maleeka. You're
the inspector at an Antarctic border post: question penguin travellers out loud, then stamp them
through or turned away. What it does: `SPEC.md`. How the team works: `TEAM.md`.

## Set up (about 10 minutes)

You need **Node.js 22.9 or newer** (the LTS from nodejs.org is fine), **Git**, and **Chrome or
Edge**. Then ask Shahil for the Mistral key in a private message.

### Windows

1. Install **Git for Windows** (git-scm.com). It comes with **Git Bash**: use Git Bash for every
   command below. Prefer buttons? **GitHub Desktop** (desktop.github.com) can clone, branch,
   commit and open pull requests.
2. Install **Node.js** LTS from nodejs.org (tick "add to PATH"). Close and reopen Git Bash, then
   check: `node --version` shows v22.9 or higher.
3. Get the code: `git clone https://github.com/shahil1dn/checkpoint.git && cd checkpoint`
   (the first time, it opens a browser to sign in to GitHub).
4. `npm install`
5. `cp .env.example .env`, then open `.env` in Notepad and paste the key straight after
   `MISTRAL_API_KEY=`. Leave the comment lines at the top where they are.
6. `npm start`, then open http://localhost:5173 in Chrome or Edge and allow the microphone.
7. Before every commit: `bash check.sh` (Windows can't run `./check.sh` directly).

### Mac

1. `gh repo clone shahil1dn/checkpoint && cd checkpoint` (install gh with `brew install gh`, then `gh auth login`)
2. `npm install`
3. `cp .env.example .env`, then paste the key after `MISTRAL_API_KEY=`
4. `npm start`, then open http://localhost:5173 in Chrome
5. Before every commit: `./check.sh`

## Commands

```bash
npm start            # the game on http://localhost:5173
npm test             # the rules, server and Mistral-call tests, no network
npm run live-check   # real questions to the travellers: consistency, notes, voice, timing
npm run rehearse     # Mac only: timed demo shift in headless Chrome (needs npm start running)
python3 scripts/smoke.py   # proves the key works and lists the models
```

How AI agents work here: `AGENTS.md` (every agent) and `CLAUDE.md` (Claude Code).
