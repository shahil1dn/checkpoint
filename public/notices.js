// The words on the booth's right wall: jokes and paperwork, flavour only.
// Nothing here may hint at who is lying, so it never names a traveller, his
// papers or his story (test/notices.test.js), and it imports nothing.

export const NOTICES = [
  {
    style: 'typed',
    title: 'SHIFT REMINDER',
    lines: ['A good question opens doors.', 'A steady hand stamps them.'],
  },
  {
    style: 'clipping',
    title: 'KEEP GOING',
    lines: ['One penguin at a time.', "You've got this, inspector."],
  },
  {
    style: 'sticky',
    title: 'BREAK ROOM',
    lines: ['The office plant is on leave.', 'Please water the rock.'],
  },
  {
    style: 'typed',
    title: 'INSPECTOR OF THE MONTH',
    lines: ['The seal. Again.'],
    picture: 'seal',
  },
  {
    style: 'sticky',
    compact: true,
    title: 'JOKE',
    lines: ['Q: Why did the stapler apply for a job?', 'A: It wanted to hold things together.'],
  },
];

// The empty spot kept on the board for the judge's rule card (SPEC stretch 11).
export const RULE_SPOT = "TODAY'S RULE";

export const FORM_TITLE = 'FORM 12: KRILL DECLARATION';
export const TIN_LABEL = 'SARDINES';

export const ALL_WORDS = [
  ...NOTICES.flatMap(({ title, lines }) => [title, ...lines]),
  RULE_SPOT, FORM_TITLE, TIN_LABEL,
];
