// Colin Stilton's records (ADR-12). He is honest, so his records are messy but
// consistent: a clerk misspelled his name, his ship came in hours late, and the
// dates are written three different ways. A typo never proves anything.

// His second paper, shown on the desk beside his travel papers.
export const ticket = {
  Passenger: 'C. Stilton',
  Ship: 'Seine Star',
  'Sailed from': 'Paris',
  'Due in': '21 Nov, 08:30',
  'Ticket no.': 'SS-4452',
  Freight: '1 trolley, blue cheese, 40 kg',
};

export const records = {
  passengers: [
    { ship: 'Seine Star', name: 'Colin Stiltn', ticket: 'SS-4452', berth: 'Deck', bookedBy: 'self', freight: '1 trolley, blue cheese, 40 kg' },
  ],
  people: [
    { name: 'Stilton, Colin', hatched: '1981, Stilton, Cambridgeshire', home: 'Stilton, Cambridgeshire', occupation: 'cheesemonger', employer: 'self-employed', visits: '11 this year, last on 17/10/2026' },
  ],
  companies: [
    {
      name: 'C. Stilton, cheesemonger',
      kind: 'sole trader, cheese',
      place: 'Stilton, Cambridgeshire',
      note: 'Food trader licence FT-311, cheese for sale, valid to 2027. Supplies the Rothera, McMurdo and Vostok research stations most months.',
      sponsorships: 'none on file',
    },
  ],
};
