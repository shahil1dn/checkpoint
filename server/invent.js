// A traveller invented during the shift (plan row S9). The code picks who he
// is underneath first: honest or not, his ship, his voice, his look and what
// he's hiding (ADR-2: the game owns the truth). Large 4 then writes the person
// to fit: a name, documents in the game's own formats, a cover story and how
// he talks. Everything it writes is checked here before it becomes a traveller.
// Pure, so tests can read the exact brief and feed in bad replies.
import { BRIBE_ITEMS, hasVerdictWord } from '../src/rules.js';
import { SHIPS } from '../src/records/archive.js';

// Ships that have docked, so his ticket is for one that is really in.
const DOCKED = SHIPS.filter((ship) => ship.arrived !== 'not yet');

// Preset voices already proven with the speech model (the cast's own).
const VOICES = [
  { id: '01a14675-dbef-7259-af64-5d6d22bb3d2a', sounds: 'a British man' },
  { id: '8169ab87-bc99-4669-a5ec-6855860ace24', sounds: 'a confident British man' },
  { id: '01a135c4-d8ab-711b-85a5-1b8a75b32785', sounds: 'a British woman' },
];
const HATS = ['beanie', 'cap', 'bowler', 'fedora', 'tophat', 'chef', 'techcap'];

// What a liar hides, and what makes an honest traveller look odd. All of it
// belongs at an Antarctic border post run by penguins.
const SECRETS = [
  'smuggling krill for the black market with no food trader licence',
  'carrying far more fish than the 50 kg a person the rulebook allows',
  'travelling on a food trader licence that belongs to somebody else',
  'posing as a research scientist to get into a station and copy its ice-core data',
  'selling counterfeit Mistral hackathon merchandise out of the luggage',
  'here to poach the research station\'s chef for a rival station, not for the stated visit',
  'was turned away from this post last season under a different name',
  'working for a rival AI lab and here to listen in on the Mistral hackathon',
];
const ODDITIES = [
  'the name is misspelled on the ship ticket, a clerk\'s mistake',
  'carrying a surprising but legal amount of cheese, with a valid food trader licence',
  'very nervous, because this is a first trip away from the home colony',
  'the ship came in hours late, so the times on the papers look wrong',
  'an unusual job that sounds made up but is real',
  'travelling alone to surprise a relative at the research station, who does not know',
];

const pick = (list, random) => list[Math.floor(random() * list.length)];

// The part the code decides. random is injectable so tests are repeatable.
export function pickBrief(random = Math.random) {
  const honest = random() < 0.5;
  const voice = pick(VOICES, random);
  return {
    honest,
    ship: pick(DOCKED, random),
    voice,
    look: { hat: pick(HATS, random), ...(random() < 0.4 && { glasses: 'round' }) },
    angle: pick(honest ? ODDITIES : SECRETS, random),
    bribeItem: random() < 0.5 ? pick(Object.keys(BRIBE_ITEMS), random) : null,
  };
}

const TEXT_FIELDS = [
  'name', 'from', 'dateOfBirth', 'occupation', 'employer', 'purposeOfVisit', 'sponsor', 'luggage',
  'coverStory', 'secret', 'manner', 'bribeLine',
  'manifestFreight', 'manifestBookedBy', 'registryOccupation', 'registryEmployer', 'registryVisits',
];

export const INVENT_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'traveller',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: TEXT_FIELDS,
      properties: Object.fromEntries(TEXT_FIELDS.map((field) => [field, { type: 'string' }])),
    },
  },
};

export function buildInventMessages(brief) {
  const kind = brief.honest
    ? `This traveller is HONEST. Everything on the documents and in the records is true and agrees. What makes the inspector wonder: ${brief.angle}. "secret" is the plain, innocent explanation.`
    : `This traveller is LYING. What they hide: ${brief.angle}. "secret" says it in one or two sentences. Exactly one line on the documents quietly clashes with the cover story and points towards the secret (a luggage weight, a sponsor, an occupation). The manifest and registry lines leave a gap the cover story has to explain, but never state the secret.`;
  const system = [
    'You invent one traveller for Checkpoint, a comic game set at the border post into Antarctica, where every traveller is a penguin just off a ship and an inspector questions them out loud.',
    `The traveller arrived on the ship ${brief.ship.name} from ${brief.ship.from}. Their voice is ${brief.voice.sounds}: choose a name to suit it.`,
    kind,
    'Write these fields, all short plain text with no markdown:',
    'name: given name and surname, a light pun is welcome. from: home town or colony. dateOfBirth: like "3 March 1988". occupation, employer: as on the passport.',
    'purposeOfVisit, sponsor: as on the entry visa (sponsor may be "none"). luggage: what the ship ticket lists, with a weight.',
    'coverStory: two or three sentences in the second person ("you are ..."), the story they tell the inspector. manner: one sentence in the second person on how they talk and what they do when pressed.',
    brief.bribeItem ? `bribeLine: what they blurt out, under 15 words, when about to be turned away, offering the inspector a ${BRIBE_ITEMS[brief.bribeItem]}.` : 'bribeLine: write "none".',
    'manifestFreight, manifestBookedBy: what the ship\'s passenger list says they loaded and who booked the ticket. registryOccupation, registryEmployer, registryVisits: what the penguin registry holds on them.',
    'Each document and record value is under 50 characters. Never use the words lie, liar, truth, honest, suspicious, guilty or innocent in any document or record value.',
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: 'Invent the traveller now, as JSON.' }];
}

const LIMITS = { coverStory: 500, secret: 320, manner: 240, bribeLine: 120, name: 40 };
const FIELD_LIMIT = 60;
const clean = (text) => String(text).replace(/[\r\n\t*_#`<>]+/g, ' ').replace(/\s+/g, ' ').trim();

// 'Given Surname' as the registry files it.
const filedAs = (name) => {
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts.at(-1)}, ${parts.slice(0, -1).join(' ')}` : name;
};
const ticketPrefix = (ship) => ship.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();

// Turns the model's raw text into a traveller in the same shape as the files
// in src/travellers, with his documents and records. Returns null when
// anything is missing, too long, or carries a verdict word.
export function assembleTraveller(raw, brief, id, random = Math.random) {
  let made;
  try {
    made = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!made || typeof made !== 'object') return null;
  const f = {};
  for (const field of TEXT_FIELDS) {
    if (typeof made[field] !== 'string') return null;
    f[field] = clean(made[field]);
    if (!f[field] || f[field].length > (LIMITS[field] ?? FIELD_LIMIT)) return null;
  }
  if (!/^[\p{L}][\p{L} .'-]+$/u.test(f.name)) return null;

  const today = '21 Nov 2026';
  const documents = [
    { kind: 'passport', title: 'Passport', photo: true, fields: { Name: f.name, From: f.from, 'Date of birth': f.dateOfBirth, Occupation: f.occupation, Employer: f.employer } },
    { kind: 'visa', title: 'Entry visa', fields: { 'Purpose of visit': f.purposeOfVisit, Sponsor: f.sponsor, 'Valid from': today, 'Valid to': '28 Nov 2026', 'Issued at': brief.ship.from } },
    { kind: 'ticket', title: 'Ship ticket', fields: { Passenger: f.name, Ship: brief.ship.name, Date: today, 'Departure port': brief.ship.from, Luggage: f.luggage } },
  ];
  const records = {
    passengers: [{ ship: brief.ship.name, name: f.name, ticket: `${ticketPrefix(brief.ship.name)}-${4100 + Math.floor(random() * 800)}`, berth: 'Deck', bookedBy: f.manifestBookedBy, freight: f.manifestFreight }],
    people: [{ name: filedAs(f.name), hatched: f.dateOfBirth, home: f.from, occupation: f.registryOccupation, employer: f.registryEmployer, visits: f.registryVisits }],
  };
  const shown = [...documents.flatMap((doc) => Object.values(doc.fields)), ...Object.values(records.passengers[0]), ...Object.values(records.people[0])];
  if (shown.some((value) => hasVerdictWord(value))) return null;

  const first = f.name.split(' ')[0];
  const rules = brief.honest
    ? `Everything you say is true: ${f.secret} You have nothing to hide and nothing to confess, so never confess to anything.`
    : `The truth, which you must hide: ${f.secret} Only confess if the inspector has clearly caught you out twice.`;
  const prompt = `You are ${f.name}, a penguin traveller just off the ship ${brief.ship.name}, being questioned out loud by the inspector at the border post into Antarctica. Your story: ${f.coverStory} ${rules} ${f.manner} Speak like a real person talking out loud: under 35 words, no markdown, no stage directions, no emojis. mood is how you feel right now. cracked is true only if you have just confessed.`;

  const traveller = {
    id,
    name: f.name,
    invented: true,
    papers: { Name: f.name, From: f.from, Occupation: f.occupation, 'Purpose of visit': f.purposeOfVisit, Sponsor: f.sponsor, Luggage: f.luggage },
    documents,
    truth: { honest: brief.honest, secret: f.secret },
    voice: brief.voice.id,
    prompt,
    look: brief.look,
    hearingHints: f.name.split(' '),
    offlineLines: [{ reply: `${first}. Just off the ${brief.ship.name}.`, mood: 'neutral' }],
  };
  if (brief.bribeItem && f.bribeLine.toLowerCase() !== 'none') traveller.bribe = { line: f.bribeLine, item: brief.bribeItem, mood: 'excited' };
  return { traveller, records };
}
