// Colin Stilton's records (ADR-12). He is honest, so his records are messy but
// consistent: a clerk misspelled his name, his ship came in hours late, and the
// dates are written three different ways. A typo never proves anything.

// No documents: he hands over his old papers as one document. (He leaves the
// queue on 21 Nov 15:25; his records stay as background.)
export default {
  records: {
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
  },
};
