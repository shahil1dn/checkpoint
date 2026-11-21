// The border's records (ADR-12): today's ship passenger lists, the penguin
// registry, the company register and the rulebook. Far too much to read during
// an interview, which is why the records terminal exists. The background
// entries come from a fixed seed, so the search is real and every run sees
// the same records. Each traveller's own entries live in his file here.
import { ALL_RECORDS } from './index.js';

// Today's arrivals. Times are local to the post.
export const SHIPS = [
  { name: 'Cape Point Courier', from: 'Cape Town', due: '07:40', arrived: '07:52', note: 'on time' },
  { name: 'Seine Star', from: 'Paris, via Le Havre', due: '08:30', arrived: '13:05', note: 'delayed 4 h 35 min by pack ice' },
  { name: 'Hobart Hopper', from: 'Hobart', due: '09:10', arrived: '09:06', note: 'on time' },
  { name: 'Golden Gate Glider', from: 'San Francisco', due: '10:16', arrived: '10:16', note: 'on time' },
  { name: 'Ushuaia Ferry', from: 'Ushuaia', due: '11:30', arrived: '11:58', note: 'late, heavy swell' },
  { name: 'Falkland Flyer', from: 'Stanley', due: '12:20', arrived: 'not yet', note: 'expected 14:00' },
];
const TICKET_PREFIX = { 'Cape Point Courier': 'CP', 'Seine Star': 'SS', 'Hobart Hopper': 'HH', 'Golden Gate Glider': 'GG', 'Ushuaia Ferry': 'UF', 'Falkland Flyer': 'FF' };

export const RULEBOOK = [
  { section: '§1', title: 'Papers', text: 'Every traveller carries travel papers and a ship ticket. The inspector may ask about any line on either.' },
  { section: '§2', title: 'Names in the records', text: 'Clerks copy names by hand from ship manifests, so misspellings are common. A near match on the name with the same ship and ticket number is the same passenger.' },
  { section: '§3', title: 'Late ships', text: 'A delayed ship keeps its passenger list. Tickets show the time a ship was due, not the time it arrived.' },
  { section: '§4', title: 'Paid and sponsored tickets', text: 'The "Paid by" line names the account that paid. Company travel accounts are listed in the company register. A sponsor is any company that pays for a traveller who does not work for it.' },
  { section: '§5', title: 'Changing ships', text: 'A passenger who sails on a different ship from the one on his ticket is listed on the ship he sailed on, not the ship on his ticket.' },
  { section: '§6', title: 'Food brought in', text: 'Cheese, fish and krill may be brought in for sale, up to 50 kg a person, by a holder of a food trader licence.' },
  { section: '§7', title: 'Visiting a company event', text: 'A traveller visiting a company event for another company must state the company he works for.' },
  { section: '§8', title: 'Who decides', text: 'The records inform the inspector. Only the inspector stamps a traveller through or turned away.' },
];

// ---- Background entries, from a fixed seed ----

// mulberry32: a tiny seeded random generator, so the archive is the same on every run.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Pip', 'Waddles', 'Nora', 'Flip', 'Ivo', 'Tuck', 'Mabel', 'Ottilie', 'Skua', 'Bramble', 'Pebbles', 'Hector', 'Ingrid', 'Rory', 'Lumi', 'Oskar', 'Wren', 'Juno', 'Barnaby', 'Freya', 'Cedric', 'Mo', 'Agnes', 'Tobias', 'Edda', 'Percy', 'Sunniva', 'Gus', 'Hattie', 'Magnus', 'Clementine', 'Arlo', 'Dagny', 'Felix', 'Greta', 'Hugo', 'Isla', 'Jasper', 'Kit', 'Lorna'];
const LAST = ['Floe', 'Krill', 'Snowdon', 'Rockhopper', 'Gentoo', 'Macaroni', 'Adelie', 'Chinstrap', 'Fjord', 'Tundra', 'Pebble', 'Sleet', 'Glacier', 'Whitlock', 'Iceby', 'Frostwick', 'Herring', 'Puddleford', 'Skerry', 'Brash', 'Shelf', 'Waddell', 'Ross', 'Weddell', 'Scotia', 'Drake', 'Petrel', 'Albatross', 'Tern', 'Sprat', 'Coldwell', 'Harbour', 'Floeberg', 'Moraine', 'Crevasse', 'Polaris'];
const COLONIES = ['Cape Adare', 'Deception Island', 'Paulet Island', 'Snow Hill', 'Zavodovski', 'Macquarie Island', 'Boulders Beach', 'Punta Tombo', 'Volunteer Point', 'Phillip Island'];
const JOBS = ['fisherman', 'krill trader', 'glaciologist', 'ship cook', 'radio operator', 'student', 'penguin photographer', 'harbour pilot', 'baker', 'station mechanic', 'retired', 'tour guide', 'weather observer', 'sculptor', 'accountant'];
const FREIGHT = ['none', 'none', 'none', '1 suitcase', '2 suitcases', '1 crate of krill, 12 kg', 'skis', 'a cello', '1 box of books', '3 kg of smoked fish', 'camera bag'];
const BERTHS = ['Deck', 'Deck', 'Cabin 2', 'Cabin 3', 'Cabin 4', 'Steerage'];
const COMPANY_WORDS = [['Krill', 'Floe', 'Glacier', 'Pebble', 'Southern', 'Polar', 'Iceshelf', 'Penguin', 'Albatross', 'Aurora', 'Blizzard', 'Snowline'], ['Logistics', 'Fisheries', 'Bank', 'Post', 'Shipping', 'Survey', 'Outfitters', 'Bakery', 'Radio', 'Tours', 'Weather', 'Insurance']];
const COMPANY_KINDS = { Logistics: 'freight company', Fisheries: 'fishing company', Bank: 'bank', Post: 'postal service', Shipping: 'shipping line', Survey: 'mapping company', Outfitters: 'cold-weather clothing', Bakery: 'bakery', Radio: 'radio station', Tours: 'tour operator', Weather: 'weather service', Insurance: 'insurer' };
const PLACES = ['Hobart', 'Cape Town', 'Ushuaia', 'Stanley', 'Punta Arenas', 'Christchurch', 'Reykjavik', 'Tromsø'];

// The clerks never agreed on one way to write a date.
const DATE_STYLES = [
  (d, m) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2026`,
  (d, m) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  (d, m) => `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][m - 1]}`,
];

// Near misses for the travellers' names, so a search has to tell them apart.
const LOOKALIKES = [
  { ship: 'Hobart Hopper', name: 'Maxwell Tokes' },
  { ship: 'Cape Point Courier', name: 'Max Tolkien' },
  { ship: 'Seine Star', name: 'Maxine Toller' },
  { ship: 'Ushuaia Ferry', name: 'Colm Stilson' },
  { ship: 'Falkland Flyer', name: 'Colin Stillman' },
];

function background() {
  const random = seeded(2111);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const companies = [];
  const seenCompanies = new Set();
  while (companies.length < 48) {
    const [first, second] = [pick(COMPANY_WORDS[0]), pick(COMPANY_WORDS[1])];
    const name = `${first} ${second}`;
    if (seenCompanies.has(name)) continue;
    seenCompanies.add(name);
    const account = `${first.slice(0, 2).toUpperCase()}${second[0]}-${String(1000 + companies.length * 37).slice(-4)}`;
    companies.push({ name, kind: COMPANY_KINDS[second], place: pick(PLACES), note: `Travel account ${account}.`, sponsorships: random() < 0.2 ? `sponsors ${pick(FIRST)} ${pick(LAST)}` : 'none on file', account });
  }
  const people = [];
  const passengers = [];
  let ticketNo = 0;
  for (const ship of SHIPS) {
    for (let i = 0; i < 40; i += 1) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      ticketNo += 1;
      const bookedBy = random() < 0.15 ? `account ${pick(companies).account}` : 'self';
      passengers.push({ ship: ship.name, name, ticket: `${TICKET_PREFIX[ship.name]}-${4000 + ticketNo * 3}`, berth: pick(BERTHS), bookedBy, freight: pick(FREIGHT) });
      if (random() < 0.6) {
        const [surname, given] = [name.split(' ')[1], name.split(' ')[0]];
        const visits = Math.floor(random() * 6);
        const last = visits ? `, last on ${pick(DATE_STYLES)(1 + Math.floor(random() * 28), 1 + Math.floor(random() * 11))}` : '';
        people.push({ name: `${surname}, ${given}`, hatched: `${1975 + Math.floor(random() * 45)}, ${pick(COLONIES)} colony`, home: pick(PLACES), occupation: pick(JOBS), employer: random() < 0.5 ? 'self-employed' : pick(companies).name, visits: visits ? `${visits} this year${last}` : 'none on file' });
      }
    }
  }
  for (const [i, { ship, name }] of LOOKALIKES.entries()) {
    passengers.push({ ship, name, ticket: `${TICKET_PREFIX[ship]}-${3900 + i * 7}`, berth: 'Deck', bookedBy: 'self', freight: '1 suitcase' });
  }
  return { passengers, people, companies };
}

// Shared by everyone: the host of today's event.
const HOST = {
  name: 'Mistral AI',
  kind: 'AI company',
  place: 'Paris',
  note: 'Holding a hackathon at the post today. Lunch order on file: blue cheese, 40 kg, from C. Stilton.',
  sponsorships: 'none on file',
};

function buildArchive() {
  const base = background();
  const all = [base, ...ALL_RECORDS];
  return {
    ships: SHIPS,
    passengers: all.flatMap((r) => r.passengers ?? []),
    people: all.flatMap((r) => r.people ?? []),
    companies: [HOST, ...all.flatMap((r) => r.companies ?? [])],
    rulebook: RULEBOOK,
  };
}

export const ARCHIVE = buildArchive();
