// ===== The records file format (ADR-12) =====
// One file per traveller: src/records/<travellerId>.js, listed in
// src/records/index.js. Every part is optional: a traveller with no file
// shows his old `papers` as one document, and the terminal searches the
// background archive only.
//
// export default {
//   // The case folder he hands over, in this order on the desk. Every line of
//   // every document can be clicked to look it up on the records terminal.
//   documents: [
//     { kind: 'passport', title: 'Passport', photo: true, fields: { Name: '…', From: '…', 'Date of birth': '…', Occupation: '…' } },
//     { kind: 'visa', title: 'Entry visa', fields: { 'Purpose of visit': '…', Sponsor: '…', 'Valid from': '…', 'Valid to': '…', 'Issued at': '…' } },
//     { kind: 'ticket', title: 'Ship ticket', fields: { Passenger: '…', Ship: '…', Date: '…', 'Departure port': '…', Seat: '…' } },
//   ],
//   // His entries in the border's records, merged into the archive the
//   // terminal searches.
//   records: {
//     passengers: [{ ship, name, ticket, berth, bookedBy, freight }],   // ship: one of SHIPS in archive.js
//     people: [{ name: 'Surname, Given', hatched, home, occupation, employer, visits }],
//     companies: [{ name, kind, place, note, sponsorships }],
//   },
// };
//
// Rules: kind is passport, visa or ticket (anything else draws as plain
// papers). Keep values short: each line is one row on a document. Records say
// only what they say: no traveller's truth or secret, and never a verdict word
// (lie, liar, truth, honest, suspicious, guilty, innocent: tested). A liar's
// records have gaps his story must cover; an honest traveller's are messy but
// consistent, so a typo never proves anything.
// ============================================

// Max Tokens lies. His documents clash with each other (a freelance passport,
// a visa sponsored by a lab), and the records have gaps his story must cover:
// his ship's list has no Tokens on it, and an M. Tokkens sailed from San
// Francisco on the sponsor's own travel account. One oddity is innocent: the
// passport gives his full name, Maximilian, and the ticket the short one.
export default {
  documents: [
    {
      kind: 'passport',
      title: 'Passport',
      photo: true,
      fields: {
        Name: 'Maximilian Tokens',
        From: 'Paris, France',
        'Date of birth': '04.03.2019',
        Occupation: 'Freelance prompt artisan',
      },
    },
    {
      kind: 'visa',
      title: 'Entry visa',
      fields: {
        'Purpose of visit': 'The Mistral hackathon',
        Sponsor: 'Frontier Horizon Labs',
        'Valid from': '20 Nov 2026',
        'Valid to': '23 Nov 2026',
        'Issued at': 'Consulate, Paris',
      },
    },
    {
      kind: 'ticket',
      title: 'Ship ticket',
      fields: {
        Passenger: 'Max Tokens',
        Ship: 'Seine Star',
        Date: '21 Nov 2026',
        'Departure port': 'Paris',
        Seat: 'Deck, row F',
        'Ticket no.': 'SS-4471',
      },
    },
  ],
  records: {
    passengers: [
      { ship: 'Golden Gate Glider', name: 'M. Tokkens', ticket: 'GG-1187', berth: 'Cabin 1', bookedBy: 'account FHL-0042', freight: '1 laptop bag' },
    ],
    people: [
      { name: 'Tokens, Max (Maximilian)', hatched: '2019, Monterey Bay colony', home: 'San Francisco', occupation: 'research', employer: 'not given', visits: 'none on file' },
    ],
    companies: [
      {
        name: 'Frontier Horizon Labs',
        kind: 'AI research lab',
        place: 'San Francisco',
        note: 'Builds large language models in direct competition with Mistral AI. Staff travel is booked by its own travel desk on account FHL-0042.',
        sponsorships: 'none on file',
      },
    ],
  },
};
