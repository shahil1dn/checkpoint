# Checkpoint

Built at the Mistral Vibe Hackathon, London, 21 Nov 2026, by Shahil, Hamzah and Maleeka. You're
the inspector at an Antarctic border post: question penguin travellers out loud, then stamp them
through or turned away. What it does: `SPEC.md`. How the team works: `TEAM.md`.

## For judges: play it in 5 minutes

The Mistral API key is not in this repo, on purpose. Bring your own: create one at
https://console.mistral.ai under **API Keys**. A full game costs a few cents.

**You need:** Node.js 22.9 or newer (nodejs.org), Git, and Chrome or Edge (for the microphone).

```bash
git clone https://github.com/shahil1dn/checkpoint.git
cd checkpoint
npm install
cp .env.example .env
```

Open `.env` in any text editor and paste your key straight after `MISTRAL_API_KEY=`, no quotes
or spaces. Then:

```bash
npm start
```

Open **http://localhost:5173** in Chrome or Edge and allow the microphone. The top bar should
say **"Live: Mistral connected."** On Windows, run the commands in Git Bash, or use
`copy .env.example .env` in Command Prompt.

**No key?** It still runs offline: the travellers give canned replies with no voices, and you type
your questions instead of speaking. The top bar says "Offline". It's playable, but the real
game is the live one.

### How to play

You're the inspector at an Antarctic border post. Three penguin travellers come off the train,
one at a time. Some are lying. Question them, check their story, and stamp them through or away.

| Do this | How |
|---|---|
| Start | Click **START SHIFT** on the computer screen |
| Ask a question | Hold **Space** and speak, or type in the box at the bottom left and press Enter |
| Read their papers | Click the case folder on the desk (or press **P**) |
| Check a detail | With the folder open, click any line; the computer on your left looks it up in the border records (3 lookups each) |
| Look around | The arrow keys, or the **‹ Computer** and **Notices ›** buttons |
| Decide | Click the **THROUGH** or **TURNED AWAY** stamp |
| Take a bribe | Some travellers offer one when you reach for TURNED AWAY: click it (or press **B**), or stamp again to refuse |
| Mute | **M** |

Each traveller gets 2 minutes and 5 questions. At the end, your view turns to the computer for
a shift review: your score, a rank, and feedback written by Mistral. The score itself comes
from the game's code, never from the model.

### What runs on Mistral

- **Voxtral Mini Transcribe** (`voxtral-mini-latest`) hears your spoken questions.
- **Voxtral Mini TTS** (`voxtral-mini-tts-3`) gives each penguin a voice that changes with their mood.
- **Mistral Medium 3.5** (`mistral-medium-3.5`):
  - plays the travellers, each with a hidden truth, replying in a fixed JSON shape (words, mood,
    whether they've cracked);
  - keeps your scratchpad notes without ever saying who's lying;
  - searches the messy border records with tool calls when you click a line;
  - writes your end-of-shift review.

### If something's off

- **The top bar says "Offline"**: the key wasn't found. Check `.env` is in the `checkpoint`
  folder and the key is right after the `=`, then restart `npm start`.
- **"bad option" or a version error on start**: update Node.js to 22.9 or newer.
- **No microphone** (or you said no to it): type your questions instead; everything else works.
- **Check your key on its own**: `python3 scripts/smoke.py` lists the models it can use.

## Team setup (about 10 minutes)

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
