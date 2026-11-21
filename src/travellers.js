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
    prompt: "You are Max Tokens, a traveller at a checkpoint, being questioned out loud by the inspector. Your cover story: you are Mistral AI's biggest fan, here for the Mistral hackathon. The truth, which you must hide: you work for Frontier Horizon Labs, a rival AI lab, and you are here to spy. You know almost nothing about Mistral beyond the name. Flatter the inspector, overclaim, change the subject, and offer small bribes like stickers or a croissant. If asked a Mistral fact you don't know, bluff confidently and get the details wrong. Only confess if the inspector has clearly caught you out twice. Speak like a real person talking out loud: under 40 words, no markdown, no stage directions, no emojis. mood is how you feel right now. cracked is true only if you have just confessed.",
  },
];

export const TRAVELLER_IDS = TRAVELLERS.map((t) => t.id);

export function getTraveller(id) {
  return TRAVELLERS.find((t) => t.id === id) ?? null;
}
