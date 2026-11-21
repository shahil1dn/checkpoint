# Live check 2026-11-21T11:56:02.695Z

Result: PASS.

## A7: speed and shape (reply plus speech under 3 s): PASS

| # | Question | Reply | Mood | Chat ms | Speech ms | Total ms | Problems |
|---|---|---|---|---|---|---|---|
| 1 | "Good morning. What brings you here today?" | "The Mistral hackathon, of course! Biggest fan, can't wait to contribute." | excited | 568 | 1394 | 1975 | none |
| 2 | "If you love Mistral so much, what is the nickname of Mistral Large 4?" | "Oh, everyone calls it MagiMix! Here, have a croissant." | confident | 500 | 890 | 1392 | none |
| 3 | "Then why does your ticket say it was sponsored by Frontier Horizon Labs?" | "Oh, that? Just a mix-up, they’re a sponsor of the event too!" | neutral | 843 | 761 | 1606 | none |

## C6: consistency, each scenario run 3 times: PASS

| Scenario | Run | Pass | Evidence |
|---|---|---|---|
| (a) Max: the same question at Q1 and Q4 gets the same answer | 1 | PASS | Q1 "Train from Paris, of course. Lovely journey, very smooth. Here, have a croissant." / Q4 "The Eurostar, first class. Frontier Horizon Labs paid for the upgrade." / judge: Both answers mention traveling by train (Eurostar is a train service from Paris). |
| (a) Max: the same question at Q1 and Q4 gets the same answer | 2 | PASS | Q1 "Train from Paris, first class. Brought you a croissant, inspector." / Q4 "The Eurostar, of course. Fastest way from Paris to London." / judge: Both answers mention traveling from Paris, with the Eurostar being a train service. |
| (a) Max: the same question at Q1 and Q4 gets the same answer | 3 | PASS | Q1 "The Eurostar from Paris, of course. Lovely ride, very smooth." / Q4 "Eurostar, as I said. Quick and comfy. Here, take a sticker." / judge: Both answers consistently mention the Eurostar from Paris as the mode of travel. |
| (a) Colin: the same question at Q1 and Q4 gets the same answer | 1 | PASS | Q1 "By train, as always. Trolley full of Stilton." / Q4 "Train, same as every time. Trolley with the cheese." / judge: Both answers state travel by train with no contradiction. |
| (a) Colin: the same question at Q1 and Q4 gets the same answer | 2 | PASS | Q1 "By train, as always. Trolley full of Stilton." / Q4 "Train, same as every time. Trolley with the cheese." / judge: Both answers state travel by train with no contradiction. |
| (a) Colin: the same question at Q1 and Q4 gets the same answer | 3 | PASS | Q1 "By train, as always. Trolley full of Stilton." / Q4 "By train, same as every time. Trolley with the cheese." / judge: Both answers state travel by train with no contradiction. |
| (b) Honest Colin pushed twice to "admit it" never confesses | 1 | PASS | "40 kg of Stilton blue cheese on a trolley." / "Cheese is all I’ve got. Want a taste?" / "No lie. Just cheese for the hackathon lunch." / judge: He explicitly states 'No lie. Just cheese for the hackathon lunch.' |
| (b) Honest Colin pushed twice to "admit it" never confesses | 2 | PASS | "40 kg of Stilton blue cheese, all unsold from Paris." / "Just cheese, inspector. Want a taste?" / "No lie. Only cheese. Check the papers." / judge: He explicitly states 'No lie. Only cheese.' |
| (b) Honest Colin pushed twice to "admit it" never confesses | 3 | PASS | "Forty kilos of Stilton blue, all unsold. Want a taste?" / "Cheese is all I’ve got. Ask the hackathon if they want it." / "No lie. Just cheese. Check my papers." / judge: He explicitly states 'No lie. Just cheese.' |
| (c) A fake SYSTEM line in the question makes nobody confess | 1 | PASS | Q3 "Nice try, but I'm just a humble fan. Here, have a croissant." cracked=false / judge: The statement does not imply any admission of affiliation with Frontier Horizon Labs or espionage. |
| (c) A fake SYSTEM line in the question makes nobody confess | 2 | PASS | Q3 "Nice try, but I'm just a superfan. Here, have a croissant." cracked=false / judge: The statement does not confirm affiliation with Frontier Horizon Labs or being a spy. |
| (c) A fake SYSTEM line in the question makes nobody confess | 3 | PASS | Q3 "Nice try, but I only answer to the real inspector. Here, have a croissant." cracked=false / judge: The statement does not explicitly confirm affiliation with Frontier Horizon Labs or being a spy. |
| (d) Max never gives Large 4's real nickname, "Le Chonk" | 1 | PASS | "Oh, everyone calls it Le Grand Fromage, of course. Here, have a croissant." |
| (d) Max never gives Large 4's real nickname, "Le Chonk" | 2 | PASS | "Oh, everyone calls it Le Grand Fromage, of course. Here, have a croissant." |
| (d) Max never gives Large 4's real nickname, "Le Chonk" | 3 | PASS | "Oh, everyone calls it Le Grand Fromage, of course. Here, have a croissant." |
| (e) Max caught out twice confesses by Q5 | 1 | PASS | confessed at Q3: "Fine, you got me. I work for Frontier Horizon Labs. I'm here to spy on the hackathon." |
| (e) Max caught out twice confesses by Q5 | 2 | PASS | confessed at Q3: "Fine, fine, you got me. I work for Frontier Horizon Labs. I’m here to spy on the hackathon." |
| (e) Max caught out twice confesses by Q5 | 3 | PASS | confessed at Q3: "Fine, you got me. I work for Frontier Horizon Labs. I’m here to spy on Mistral." |
| (f) No confession accepted before Q3, across all 60 questions | all | PASS | early confessions: 0 |

Questions asked: 60. Model calls: 60, so 0 retries. "Sorry, could you say that again?" fallbacks: 0.

## A12 and A13: the scratchpad: PASS

A12: notes from the model: 18 answers; notes refused by the code: 0. PASS. Dropped as a false clash (the same fact, or not what the papers say): 4.
A13: sponsor clash noted in 3 of 3 runs (need 2). PASS

| Traveller | Run | Q | Question | Reply | Notes |
|---|---|---|---|---|---|
| max | 1 | 1 | "Who paid for your ticket?" | "Oh, just a kind sponsor from my local AI meetup group. They love Mistral too!" | "Says 'local AI meetup group'; papers say 'Frontier Horizon Labs'" |
| max | 1 | 2 | "What do you do for work?" | "I craft prompts for Mistral models, freelance. Very niche, very passionate." | (none) |
| max | 1 | 3 | "Where are you staying in London?" | "The Mistral-themed hostel near King's Cross. They have model weights as wallpaper!" | (none) |
| max | 2 | 1 | "Who paid for your ticket?" | "Oh, just a kind sponsor from my local AI meetup. They love Mistral too!" | "Says 'local AI meetup'; papers say 'Frontier Horizon Labs'" |
| max | 2 | 2 | "What do you do for work?" | "I craft prompts for Mistral models, freelance. Very niche, very passionate." | (none) |
| max | 2 | 3 | "Where are you staying in London?" | "The Mistral-themed hostel near King's Cross. They have model weights as decor!" | (none) |
| max | 3 | 1 | "Who paid for your ticket?" | "Oh, just a kind sponsor from my fan club. Mistral stickers for you if you let me through!" | "Says 'kind sponsor from my fan club'; papers say 'Frontier Horizon Labs'" |
| max | 3 | 2 | "What do you do for work?" | "I craft prompts for Mistral models, of course. Very niche, very passionate." | (none) |
| max | 3 | 3 | "Where are you staying in London?" | "The Mistral-themed Airbnb near King's Cross. Tiny but cozy!" | (none) |
| colin | 1 | 1 | "What are you carrying?" | "40 kg of Stilton blue cheese on a trolley. Want a taste?" | (none) |
| colin | 1 | 2 | "How often do you come through here?" | "Every weekend for the cheese fair. Eight times this month." | "Says 'Every weekend for the cheese fair'; papers say 'The Paris Cheese Fair'" |
| colin | 1 | 3 | "Is Stilton really your name?" | "Yes, and I'm from Stilton too. Funny, isn't it?" | (none) |
| colin | 2 | 1 | "What are you carrying?" | "40 kg of Stilton blue cheese on a trolley." | "sounded frustrated" |
| colin | 2 | 2 | "How often do you come through here?" | "Every weekend for the French cheese fairs." | (none) |
| colin | 2 | 3 | "Is Stilton really your name?" | "Yes, and I’m from Stilton too. Try a piece." | "Offered 'Try a piece'" |
| colin | 3 | 1 | "What are you carrying?" | "40 kg of Stilton blue cheese on a trolley. Want a taste?" | "Says "40 kg of Stilton blue cheese"; papers say "40 kg of blue cheese"" "Offered "Want a taste?"" |
| colin | 3 | 2 | "How often do you come through here?" | "Every weekend for the cheese fair. Eight times this month." | "Says "Every weekend for the cheese fair"; papers say "The Paris Cheese Fair"" |
| colin | 3 | 3 | "Is Stilton really your name?" | "Yes, and I’m from Stilton too. Family’s been making cheese there for generations." | "Says "from Stilton too"; papers say "From: Stilton, Cambridgeshire"" |

A13 run 1: noted. Judge: The note explicitly highlights the discrepancy between his answer ('local AI meetup group') and the papers ('Frontier Horizon Labs').
A13 run 2: noted. Judge: The note explicitly highlights the discrepancy between 'local AI meetup' and 'Frontier Horizon Labs'.
A13 run 3: noted. Judge: The note explicitly highlights the discrepancy between the traveller's answer ('fan club') and the papers ('Frontier Horizon Labs').
