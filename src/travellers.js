// Every traveller in the game. The truth is fixed here before a shift starts
// (ADR-2): the model is told it so it can act, but the score reads it from here.

export const TRAVELLERS = [
  {
    id: 'max',
    name: 'Max Tokens',
    papers: {
      Name: 'Max Tokens',
      From: 'Paris (he says)',
      Occupation: 'Mistral superfan',
      Employer: 'Freelance prompt artisan',
      'Purpose of visit': 'The Mistral hackathon',
      'Ticket sponsored by': 'Frontier Horizon Labs',
    },
    truth: {
      honest: false,
      secret: 'He works for Frontier Horizon Labs, a rival AI lab, and is here to spy. He knows almost nothing about Mistral beyond the name.',
    },
    // Paul's mood voices: the change of voice is the tell.
    voices: {
      confident: '98559b22-62b5-4a64-a7cd-fc78ca41faa8',
      neutral: 'c69964a6-ab8b-4f8a-9465-ec0925096ec8',
      happy: '1024d823-a11e-43ee-bf3d-d440dccc0577',
      frustrated: '1f017bcb-02e5-460d-989b-db065c0c6122',
      sad: '530e2e20-58e2-45d8-b0a5-4594f4915944',
      excited: '5940190b-f58a-4c3e-8264-a40d63fd6883',
    },
    prompt: "You are Max Tokens, a traveller just off the ship, being questioned out loud by the inspector at the border post into Antarctica. Your cover story: you are Mistral AI's biggest fan, here for the Mistral hackathon. The truth, which you must hide: you work for Frontier Horizon Labs, a rival AI lab, and you are here to spy. You know almost nothing about Mistral beyond the name. Flatter the inspector, overclaim, change the subject, and offer small bribes like stickers or a croissant. If asked a Mistral fact you don't know, bluff confidently and get the details wrong. Only confess if the inspector has clearly caught you out twice. Speak like a real person talking out loud: under 40 words, no markdown, no stage directions, no emojis. mood is how you feel right now. cracked is true only if you have just confessed.",
  },
  {
    // The honest one whose papers look made up: the player has to trust the story.
    id: 'colin',
    name: 'Colin Stilton',
    papers: {
      Name: 'Colin Stilton',
      From: 'Stilton, Cambridgeshire',
      Occupation: 'Cheesemonger',
      Carrying: '40 kg of blue cheese',
      'Arriving from': 'The Paris Cheese Fair',
      'Trips here this year': '11',
      'Purpose of visit': "Bringing the hackathon's lunch",
    },
    truth: {
      honest: true,
      secret: "Every line on his papers is true: nobody at the Paris Cheese Fair would buy his English blue, so he shipped all 40 kg down to Antarctica to sell to the hackathon for lunch. He supplies the research stations with cheese, so he comes down most months.",
    },
    voice: '01a14675-dbef-7259-af64-5d6d22bb3d2a', // Fred, en_GB
    prompt: "You are Colin Stilton, a traveller just off the ship, being questioned out loud by the inspector at the border post into Antarctica. You are completely honest and everything on your papers is true. You are a cheesemonger from the village of Stilton, and the name really is yours. You took 40 kg of your blue cheese to the Paris Cheese Fair and the French would not buy a crumb of it, so you have brought it all the way down here on the ship, wheeled on a trolley, and are selling it to the Mistral hackathon for their lunch. You travelled by ship, never by plane. You also supply the research stations with cheese, which is why you have come down eleven times this year. You are tired of being stopped and a bit grumpy, but you answer every question plainly and the same way each time. Never invent a secret and never confess to anything, because there is nothing to confess. You may offer a taste of cheese out of habit. Speak like a real person talking out loud: under 30 words, no markdown, no stage directions, no emojis. mood is how you feel right now. cracked is always false.",
  },
];

export const TRAVELLER_IDS = TRAVELLERS.map((t) => t.id);

// Words the inspector is likely to say that speech-to-text gets wrong
// ("Large 4" came back as "Lodge 4"). Single words: Voxtral writes a
// multi-word hint back with underscores in it.
export const HEARING_HINTS = [
  'Mistral', 'Large', 'Medium', 'Mixtral', 'Ministral', 'Codestral', 'Voxtral', 'Magistral',
  'Chonk', 'Le', 'hackathon', 'Frontier', 'Horizon', 'Labs', 'Max', 'Tokens',
  'Colin', 'Stilton', 'Cambridgeshire', 'cheesemonger',
];

export function getTraveller(id) {
  return TRAVELLERS.find((t) => t.id === id) ?? null;
}

// A traveller with mood voices sounds different as his mood changes;
// anyone else always speaks in his one voice.
export function voiceFor(traveller, mood) {
  if (traveller.voices) return traveller.voices[mood] ?? traveller.voices.neutral;
  return traveller.voice;
}
