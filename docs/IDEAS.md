# Ideas

Open track, judged on creativity, powered by the Mistral API. One line per idea: what it is,
the moment in the demo that makes a judge react, and which Mistral model does the work.

Shortlist from a five-persona brainstorm, 21 Nov 10:15. Ranked best first.

| Idea | Demo moment | Model | Recycles |
|---|---|---|---|
| **Checkpoint** (Shahil's mix, 10:20): a document-inspection border post plus Fang Street's "suck up to get in" trust meter, all by voice. Own world and look; we borrow the checkpoint idea, not any existing game. Open question: is the player the traveller or the inspector? | Traveller version: a judge scribbles a passport on paper, holds it to the camera, and talks their way past a guard whose voice turns from frustrated to happy as trust rises. | OCR 4 (reads the paper), Large 4 (inspects the papers; its thinking pause is the guard squinting), Voxtral in, Ministral 8B (live replies), Voxtral TTS with mood voices | Fang Street rules engine and character brain |
| **Clicker Mind**: the room trains a talking creature like a dog. Phones tap "good" or "no"; every ~10 s the AI rewrites the creature's personality from the taps. | Judges watch a habit they rewarded appear in its voice, and a learning curve climb on screen. | Ministral 8B (creature), Large 4 (rewrites the personality), Voxtral TTS (voice) | Volley phone join, Fang Street character brain |
| **The Bureaucrat**: a deadpan clerk who rejects your handwritten form for ever-pettier reasons. Win by getting it stamped. | A judge fills a paper form, holds it to the camera, and the clerk reads out a rejection about their handwriting. | OCR 4 (reads the form), Magistral (finds the petty fault), Voxtral TTS | Fang Street rules engine (trust meter, turn limit) |
| **Murmuration**: every phone's one-word answer becomes a starling; words with similar meaning flock together on the big screen. | A judge types a word and watches their bird peel off and join, or start, a flock. | Mistral embeddings (meaning), Ministral 3B (narrates the flocks) | Volley phone join |
| **Portici by voice**: walk the empty Bologna street and talk out loud to the shopkeepers under the arches. | A judge speaks into the mic and a shopkeeper answers in a voice, in 3D. | Voxtral realtime (speech in), Ministral 8B, Voxtral TTS | Portici street and sound, Fang Street brain |
| **Immune Ask Bar**: an assistant that learns from attacks. Each trick that works becomes a "memory cell" that blocks that whole family of tricks. | A judge breaks it once, tries the same trick reworded, and it bounces off. | Ministral (attack variants), embeddings (memory cells), Large 4 | AI Builders ask bar and its answer check |

Live voice replies should use a Ministral model: Large 4 thinks before every answer, too slow for
back-and-forth speech.

**Chosen (10:25):** Checkpoint, **inspector version**. Fang Street flipped: the player questions
AI travellers out loud until they're sure, then lets each one through or turns them away.

- Each traveller arrives with papers and a story. They answer out loud in their own voice, and
  they suck up, flatter, bribe and dodge: Fang Street's sucking up, now aimed at the player.
- The game decides each traveller's truth (honest, or what they're hiding) before they arrive,
  and the AI only plays that role. So the AI can't change its story mid-game, and a script, not
  the model, marks the player right or wrong.
- Pressure from Fang Street's rules: a question limit per traveller and a shift clock.
- The tell: pressed on a lie, the traveller's voice changes mood (confident, then frustrated).
- Paper: at the start a judge handwrites today's rule on a card; the AI reads it, and every
  traveller that shift has to deal with it.
- Setting and look: not chosen yet.
