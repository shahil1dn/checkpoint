// Granny Pebble's records (format: top of src/records/max.js). She lies, so
// her records have gaps her story has to cover: her handbag was weighed at
// 41 kg at the gangway, she has no food trader licence, and a krill buyer
// has her on file as a seller. Her grandson Pip is real.
export default {
  documents: [
    {
      kind: 'passport',
      title: 'Passport',
      photo: true,
      fields: {
        Name: 'Edna Pebble',
        From: 'Fang Street, London',
        'Date of birth': '02.02.1941',
        Occupation: 'Retired',
      },
    },
    {
      kind: 'visa',
      title: 'Entry visa',
      fields: {
        'Purpose of visit': 'Visiting her grandson',
        Sponsor: 'None',
        'Valid from': '21 Nov 2026',
        'Valid to': '5 Dec 2026',
        'Issued at': 'Consulate, London',
      },
    },
    {
      kind: 'ticket',
      title: 'Ship ticket',
      fields: {
        Passenger: 'E. Pebble',
        Ship: 'Ushuaia Ferry',
        Date: '21 Nov 2026',
        'Departure port': 'Ushuaia',
        Luggage: 'One handbag',
        'Weight of luggage': '41 kg',
      },
    },
  ],
  records: {
    passengers: [
      { ship: 'Ushuaia Ferry', name: 'Edna Pebble', ticket: 'UF-4119', berth: 'Deck', bookedBy: 'self', freight: '1 handbag, 41 kg, weighed at the gangway' },
    ],
    people: [
      { name: 'Pebble, Edna', hatched: '1941, Fang Street, London', home: 'Fang Street, London', occupation: 'retired', employer: 'none', visits: '4 this year, last on 2026-09-30' },
      { name: 'Pebble, Pip', hatched: '2001, Fang Street, London', home: 'Rothera research station', occupation: 'station cook', employer: 'Rothera research station', visits: 'lives at the post' },
    ],
    companies: [
      {
        name: 'Southern Krill Exchange',
        kind: 'krill wholesaler',
        place: 'Ushuaia',
        note: 'Buys krill by the kilo for cash. Sellers on file this year: E. Pebble, Fang Street (3 sales, 38 to 41 kg each). No food trader licence on file for E. Pebble.',
        sponsorships: 'none on file',
      },
    ],
  },
};
