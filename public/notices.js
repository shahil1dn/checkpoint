// The words on the booth's right wall: jokes and paperwork, flavour only.
// Nothing here may hint at who is lying, so it never names a traveller, his
// papers or his story (test/notices.test.js), and it imports nothing.

export const NOTICES = [
  {
    style: 'typed',
    title: 'STAFF NOTICE',
    lines: ['Whoever keeps taking the fish fingers from the staff fridge: we know.', 'Please stop.', '- The Management'],
  },
  {
    style: 'clipping',
    title: 'RIVAL LAB BULLETIN',
    lines: ['"Our new model is 4% better at something."', 'Details to follow. Probably.'],
  },
  {
    style: 'sticky',
    title: 'LOST',
    lines: ['One left mitten.', 'Answers to "Mitten".'],
  },
  {
    style: 'typed',
    title: 'INSPECTOR OF THE MONTH',
    lines: ['The seal. Again.'],
    picture: 'seal',
  },
];

// The empty spot kept on the board for the judge's rule card (SPEC stretch 11).
export const RULE_SPOT = "TODAY'S RULE";

export const FORM_TITLE = 'FORM 12: FISH DECLARATION';
export const TIN_LABEL = 'SARDINES';

export const ALL_WORDS = [
  ...NOTICES.flatMap(({ title, lines }) => [title, ...lines]),
  RULE_SPOT, FORM_TITLE, TIN_LABEL,
];
