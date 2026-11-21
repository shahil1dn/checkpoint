// Max Tokens's records (ADR-12). He lies, so the records have gaps his story
// has to cover: his ticket is for the Paris ship, but the Paris ship's list
// has no Tokens on it, and the account that paid books its own staff's travel.
// Nothing here says he lies: the records only say what they say.

// His second paper, shown on the desk beside his travel papers.
export const ticket = {
  Passenger: 'Max Tokens',
  Ship: 'Seine Star',
  'Sailed from': 'Paris',
  'Due in': '21 Nov, 08:30',
  'Ticket no.': 'SS-4471',
  'Paid by': 'Frontier Horizon Labs, account FHL-0042',
};

export const records = {
  passengers: [
    { ship: 'Golden Gate Glider', name: 'M. Tokkens', ticket: 'GG-1187', berth: 'Cabin 1', bookedBy: 'account FHL-0042', freight: '1 laptop bag' },
  ],
  people: [
    { name: 'Tokens, Max', hatched: '2019, Monterey Bay colony', home: 'San Francisco', occupation: 'research', employer: 'not given', visits: 'none on file' },
  ],
  companies: [
    {
      name: 'Frontier Horizon Labs',
      kind: 'AI research lab',
      place: 'San Francisco',
      note: 'Builds large language models; a direct competitor of Mistral AI. Staff travel is booked by its own travel desk on account FHL-0042.',
      sponsorships: 'none on file',
    },
  ],
};
