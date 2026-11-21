// The records terminal's tools (ADR-12). Pure searches over the archive: the
// model asks for one by name, the code runs it, and the code writes the step
// line the inspector sees. Nothing here can reach a traveller's truth: the
// archive holds only records.
import { ARCHIVE } from './archive.js';

const MAX_MATCHES = 5;
const NEAR = 0.7;

const plain = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9§\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => plain(s).split(' ').filter(Boolean);

function editDistance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next.push(Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}

// "M." matches "Max", "Max" matches "Maxwell", "Tokkens" nearly matches "Tokens".
function wordLikeness(q, w) {
  if (q === w) return 1;
  if (q.length === 1 || w.length === 1) return q[0] === w[0] ? 0.8 : 0;
  if (q.length >= 3 && (w.startsWith(q) || q.startsWith(w))) return 0.8;
  return 1 - editDistance(q, w) / Math.max(q.length, w.length);
}

// How well the query's words match a record's words, 0 to 1, in any order,
// so "Tokens, Max" and "Max Tokens" are the same name.
export function likeness(query, text) {
  const qs = words(query);
  const ws = words(text);
  if (!qs.length || !ws.length) return 0;
  if (plain(text).includes(plain(query))) return 1;
  return qs.reduce((sum, q) => sum + Math.max(...ws.map((w) => wordLikeness(q, w))), 0) / qs.length;
}

function best(entries, query, textOf) {
  return entries
    .map((entry) => ({ entry, score: likeness(query, textOf(entry)) }))
    .filter((m) => m.score >= NEAR)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES);
}

const countWords = (n, one) => (n === 0 ? `no ${one}es` : n === 1 ? `1 ${one}` : `${n} ${one}es`);
const matchWord = (matches) => {
  const exact = matches.filter((m) => m.score >= 0.99).length;
  const near = matches.length - exact;
  if (!matches.length) return 'no matches';
  return [exact && `${exact} exact`, near && `${near} near`].filter(Boolean).join(', ') + (matches.length === 1 ? ' match' : ' matches');
};
const shown = (matches) => matches.map(({ entry, score }) => ({ ...entry, match: score >= 0.99 ? 'exact' : 'near' }));

function findShips(name) {
  if (!name) return ARCHIVE.ships;
  return ARCHIVE.ships.filter((s) => likeness(name, `${s.name} ${s.from}`) >= NEAR);
}

// Each tool returns { result } for the model and { step } for the screen.
export const TOOLS = {
  search_passenger_lists({ name, ship, ticket_or_account } = {}) {
    const ships = findShips(ship);
    const onShips = ARCHIVE.passengers.filter((p) => ships.some((s) => s.name === p.ship));
    const query = name || ticket_or_account;
    const matches = query ? best(onShips, query, (p) => (name ? p.name : `${p.ticket} ${p.bookedBy}`)) : [];
    const where = ship ? (ships.length ? `the ${ships.map((s) => s.name).join(', ')} list` : `lists for "${ship}"`) : 'today\'s passenger lists';
    const looking = query ? ` for "${query}"` : '';
    return {
      result: { ships, searched: onShips.length, matches: shown(matches) },
      step: `searched ${where}${looking} (${onShips.length} passengers): ${query ? matchWord(matches) : `${countWords(ships.length, 'ship')} found`}`,
    };
  },
  find_person({ name } = {}) {
    const matches = name ? best(ARCHIVE.people, name, (p) => p.name) : [];
    return {
      result: { searched: ARCHIVE.people.length, matches: shown(matches) },
      step: `searched the penguin registry for "${name ?? ''}" (${ARCHIVE.people.length} entries): ${matchWord(matches)}`,
    };
  },
  find_company({ name } = {}) {
    const matches = name ? best(ARCHIVE.companies, name, (c) => `${c.name} ${c.note}`) : [];
    return {
      result: { searched: ARCHIVE.companies.length, matches: shown(matches).map(({ account, ...c }) => c) },
      step: `searched the company register for "${name ?? ''}" (${ARCHIVE.companies.length} entries): ${matchWord(matches)}`,
    };
  },
  read_rulebook({ topic } = {}) {
    const sections = ARCHIVE.rulebook
      .map((s) => ({ s, score: likeness(topic, `${s.section} ${s.title} ${s.text}`) }))
      .filter((m) => m.score >= NEAR)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((m) => m.s);
    return {
      result: { sections },
      step: sections.length ? `read rulebook ${sections.map((s) => s.section).join(' and ')}` : `found nothing in the rulebook on "${topic ?? ''}"`,
    };
  },
};

// Runs one tool call from the model. Its arguments are untrusted: anything
// that isn't a short string is dropped, and an unknown tool is reported back.
export function runTool(name, args) {
  const tool = Object.hasOwn(TOOLS, name) ? TOOLS[name] : null;
  if (!tool) return { result: { error: `no tool called ${name}` }, step: 'asked for a tool that does not exist' };
  const clean = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (typeof value === 'string' && value.trim() && value.length <= 120) clean[key] = value.trim();
  }
  return tool(clean);
}
