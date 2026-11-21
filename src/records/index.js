// Every traveller's records file (format: top of src/records/max.js). Adding
// one is a new file plus one line here.
import max from './max.js';
import colin from './colin.js';
import rupert from './rupert.js';
import pebble from './pebble.js';

const FILES = { max, colin, rupert, pebble };

export const ALL_RECORDS = Object.values(FILES).map((file) => file.records ?? {});

// The case folder he hands over: his documents, or his old papers as one
// document when he has no records file or no documents in it.
export function documentsFor(traveller) {
  // An invented traveller (plan row S9) has no file and carries his own.
  const documents = FILES[traveller?.id]?.documents ?? traveller?.documents;
  if (documents?.length) return documents;
  return [{ kind: 'papers', title: 'Travel papers', fields: traveller?.papers ?? {} }];
}

// Every line of his documents as one flat list of fields, labelled by
// document, for the prompts that need to know what the inspector can see.
export function papersFor(traveller) {
  const documents = documentsFor(traveller);
  if (documents.length === 1 && documents[0].kind === 'papers') return documents[0].fields;
  return Object.fromEntries(documents.flatMap((doc) => Object.entries(doc.fields).map(([label, value]) => [`${doc.title}, ${label}`, value])));
}

// The name his documents give, so the terminal can check a ship or ticket
// line against the right passenger.
export function nameOnDocuments(traveller) {
  for (const doc of documentsFor(traveller)) {
    const name = doc.fields.Name ?? doc.fields.Passenger;
    if (name) return name;
  }
  return traveller?.name ?? '';
}
