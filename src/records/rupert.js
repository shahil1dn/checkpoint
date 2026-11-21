// Rupert Ashworth-Hale's records (format: top of src/records/max.js). He is
// honest but sounds shady, so his records are messy but consistent: a clerk
// misspelled his name, his "acquisition" is a licensed krill-snack start-up
// his fund backs, and there's no return ticket because the fund chartered a
// boat home for the whole team.
export default {
  documents: [
    {
      kind: 'passport',
      title: 'Passport',
      photo: true,
      fields: {
        Name: 'Rupert Ashworth-Hale',
        From: 'London',
        'Date of birth': '12.06.1996',
        Occupation: 'Finance (the City)',
      },
    },
    {
      kind: 'visa',
      title: 'Entry visa',
      fields: {
        'Purpose of visit': 'Team offsite',
        Sponsor: 'Thamesbridge Capital',
        'Board seat': 'Krillionaire Snacks',
        'Valid to': '23 Nov 2026',
        'Issued at': 'Consulate, London',
      },
    },
    {
      kind: 'ticket',
      title: 'Ship ticket',
      fields: {
        Passenger: 'R. Ashworth-Hale',
        Ship: 'Cape Point Courier',
        Date: '21 Nov 2026',
        'Departure port': 'Cape Town',
        Seat: 'Cabin 2',
        'Return ticket': 'None',
      },
    },
  ],
  records: {
    passengers: [
      { ship: 'Cape Point Courier', name: 'Rupert Ashworth-Hail', ticket: 'CP-2210', berth: 'Cabin 2', bookedBy: 'account TBC-0007', freight: '1 case of krill snack samples, 6 kg' },
    ],
    people: [
      { name: 'Ashworth Hale, Rupert', hatched: '1996, London', home: 'London', occupation: 'banker', employer: 'Thamesbridge Capital', visits: 'none on file' },
    ],
    companies: [
      {
        name: 'Thamesbridge Capital',
        kind: 'investment fund',
        place: 'Canary Wharf, London',
        note: 'Team offsite "Synergy Retreat" at the post, 21 to 23 Nov: 14 staff. Return charter booked for the whole group, departs 23 Nov, booking held by the office manager. Travel account TBC-0007.',
        sponsorships: 'its own staff only',
      },
      {
        name: 'Krillionaire Snacks',
        kind: 'krill-snack start-up',
        place: 'London',
        note: 'Food trader licence FT-882, krill snacks. Backed by Thamesbridge Capital; board includes R. Ashworth-Hale.',
        sponsorships: 'none on file',
      },
    ],
  },
};
