// Speech bubbles: a white rounded bubble with an ink outline and a tail, holding one picture
// instead of words, so a penguin can ask for the Wi-Fi or refuse someone without any text to read.
// bubbleTexture(key) draws each one once and reuses it.
import * as THREE from 'three';
import { INK } from './engine.js';

const W = 192, H = 144, RED = '#c0392b', GOLD = '#d9a93a', CREAM = '#f1e6c8';
const cache = new Map();

function bubble(g) {
  g.lineJoin = g.lineCap = 'round'; g.lineWidth = 6; g.strokeStyle = INK; g.fillStyle = '#ffffff';
  const x = 10, y = 8, w = W - 20, h = H - 44, r = 26;
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.lineTo(58, y + h); g.lineTo(30, H - 8); g.lineTo(40, y + h);   // the tail, down to the left
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  g.fill(); g.stroke();
}
const CX = W / 2, CY = 58;   // centre of the bubble's picture area

function wifi(g, x, y, s = 1) {
  g.strokeStyle = INK; g.lineWidth = 7 * s; g.lineCap = 'round';
  for (const r of [14, 28, 42]) { g.beginPath(); g.arc(x, y, r * s, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
  g.fillStyle = INK; g.beginPath(); g.arc(x, y, 6 * s, 0, Math.PI * 2); g.fill();
}
function text(g, str, x, y, size, colour = INK, weight = 900) {
  g.fillStyle = colour; g.font = `${weight} ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, x, y);
}
function envelope(g, x, y, sealed) {
  const w = 76, h = 50;
  g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = 5;
  g.fillRect(x - w / 2, y - h / 2, w, h); g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.beginPath();
  if (sealed) { g.moveTo(x - w / 2, y - h / 2); g.lineTo(x, y + 4); g.lineTo(x + w / 2, y - h / 2); }
  else { g.moveTo(x - w / 2, y - h / 2); g.lineTo(x, y - h / 2 - 26); g.lineTo(x + w / 2, y - h / 2); }   // flap open
  g.stroke();
  if (sealed) { g.fillStyle = RED; g.beginPath(); g.arc(x, y + 4, 10, 0, Math.PI * 2); g.fill(); g.stroke(); }
  else { g.fillStyle = '#ffffff'; g.fillRect(x - 24, y - h / 2 - 12, 48, 22); g.strokeRect(x - 24, y - h / 2 - 12, 48, 22); }   // the letter sliding out
}
function cup(g, x, y) {
  g.fillStyle = '#f3f1ec'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.moveTo(x - 20, y - 22); g.lineTo(x + 20, y - 22); g.lineTo(x + 15, y + 26); g.lineTo(x - 15, y + 26); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#8c6448'; g.fillRect(x - 19, y - 4, 38, 14); g.strokeRect(x - 19, y - 4, 38, 14);   // sleeve
  g.fillStyle = '#3a3f4a'; g.fillRect(x - 24, y - 32, 48, 11); g.strokeRect(x - 24, y - 32, 48, 11); // lid
  g.strokeStyle = '#9aa3ad'; g.lineWidth = 4;
  for (const dx of [-8, 8]) { g.beginPath(); g.moveTo(x + dx, y - 40); g.quadraticCurveTo(x + dx + 8, y - 48, x + dx, y - 56); g.stroke(); }   // steam
}
function towel(g, x, y) {
  g.strokeStyle = INK; g.lineWidth = 5;
  for (const [dy, colour] of [[12, '#d8e3e6'], [-4, '#ffffff'], [-20, '#d8e3e6']]) {
    g.fillStyle = colour; g.beginPath(); g.roundRect(x - 36, y + dy - 8, 72, 16, 7); g.fill(); g.stroke();
  }
}
function sack(g, x, y) {
  g.fillStyle = '#9a8a6e'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.ellipse(x, y + 8, 30, 26, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 12, y - 16); g.lineTo(x - 18, y - 30); g.lineTo(x + 18, y - 30); g.lineTo(x + 12, y - 16); g.closePath(); g.fill(); g.stroke();
  text(g, '$', x, y + 10, 34, GOLD);
}
// A cartoon face in the bubble: two arcs or slits for eyes, and a mouth drawn by `mouth`.
function faceRing(g, x, y) {
  g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#fbf3dc';
  g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill(); g.stroke();
}
function evilFace(g, x, y) {   // horns, a frown over slit eyes, and a wide toothy grin
  g.fillStyle = RED; g.strokeStyle = INK; g.lineWidth = 4;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(x + s * 14, y - 30); g.quadraticCurveTo(x + s * 30, y - 44, x + s * 30, y - 58); g.quadraticCurveTo(x + s * 36, y - 38, x + s * 28, y - 24); g.closePath(); g.fill(); g.stroke();
  }
  faceRing(g, x, y);
  g.lineWidth = 5; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(x + s * 22, y - 18); g.lineTo(x + s * 5, y - 10); g.stroke();   // brows sloping in
    g.beginPath(); g.moveTo(x + s * 19, y - 4); g.lineTo(x + s * 8, y - 2); g.stroke();     // narrowed eyes
  }
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(x - 22, y + 8); g.quadraticCurveTo(x, y + 34, x + 22, y + 8); g.quadraticCurveTo(x, y + 16, x - 22, y + 8); g.fill(); g.stroke();
  g.lineWidth = 3;
  for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(x + dx, y + 12); g.lineTo(x + dx, y + 22); g.stroke(); }   // teeth
}
function yumFace(g, x, y) {   // happy shut eyes and a tongue licking round the lips
  faceRing(g, x, y);
  g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 13, y - 4, 7, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  g.beginPath(); g.arc(x, y + 6, 16, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  g.fillStyle = '#e07a86';
  g.beginPath(); g.ellipse(x + 11, y + 22, 7, 9, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
}
function happyFace(g, x, y) {   // "^ ^" eyes, blushing cheeks and a wide open grin
  faceRing(g, x, y);
  g.fillStyle = '#e8a0a0';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 21, y + 6, 7, 4.5, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 13, y - 2, 7, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  g.fillStyle = INK; g.beginPath(); g.moveTo(x - 17, y + 8); g.quadraticCurveTo(x, y + 36, x + 17, y + 8); g.closePath(); g.fill();
  g.fillStyle = '#e07a86'; g.beginPath(); g.ellipse(x, y + 20, 8, 4.5, 0, 0, Math.PI * 2); g.fill();   // tongue
}
function wrench(g, x, y) {   // a spanner, tilted: an open jaw at the top, a ring at the foot
  g.save(); g.translate(x, y); g.rotate(-0.7);
  g.fillStyle = '#b4bec3'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.roundRect(-8, -34, 16, 62, 6); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -40, 17, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.rect(-7, -60, 14, 22); g.fill();
  g.beginPath(); g.moveTo(-7, -38); g.lineTo(-7, -56); g.moveTo(7, -38); g.lineTo(7, -56); g.stroke();
  g.fillStyle = '#b4bec3'; g.beginPath(); g.arc(0, 34, 13, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 34, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.restore();
}
function meltedLolly(g, x, y) {   // an ice lolly sagging on its stick, dripping into a puddle
  g.strokeStyle = INK; g.lineWidth = 5;
  g.fillStyle = '#d9b98a'; g.fillRect(x - 5, y + 6, 10, 26); g.strokeRect(x - 5, y + 6, 10, 26);
  g.fillStyle = '#d9776b';
  g.beginPath(); g.ellipse(x, y + 40, 30, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - 20, y + 10); g.quadraticCurveTo(x - 26, y - 30, x - 2, y - 30); g.quadraticCurveTo(x + 22, y - 32, x + 20, y + 4);
  g.quadraticCurveTo(x + 18, y + 14, x + 12, y + 10); g.quadraticCurveTo(x, y + 20, x - 8, y + 12); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(x + 24, y + 22, 5, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
}
function bolt(g, x, y) {   // a lightning bolt: power
  g.fillStyle = GOLD; g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath();
  for (const [dx, dy] of [[6, -40], [-18, 6], [-2, 6], [-8, 40], [18, -8], [2, -8], [10, -40]]) g.lineTo(x + dx, y + dy);
  g.closePath(); g.fill(); g.stroke();
}
function note(g, x, y) {   // a clipboard, a few lines written on it, and the pencil writing them
  g.strokeStyle = INK; g.lineWidth = 5;
  g.fillStyle = '#8c6448'; g.beginPath(); g.roundRect(x - 26, y - 32, 52, 66, 6); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(x - 19, y - 22, 38, 50); g.strokeRect(x - 19, y - 22, 38, 50);
  g.fillStyle = '#b4bec3'; g.fillRect(x - 12, y - 38, 24, 12); g.strokeRect(x - 12, y - 38, 24, 12);
  g.lineWidth = 3.5;
  for (const [dy, len] of [[-12, 24], [-2, 24], [8, 14]]) { g.beginPath(); g.moveTo(x - 13, y + dy); g.lineTo(x - 13 + len, y + dy); g.stroke(); }
  g.save(); g.translate(x + 26, y + 2); g.rotate(0.7); g.fillStyle = GOLD; g.lineWidth = 4;
  g.fillRect(-6, -34, 12, 40); g.strokeRect(-6, -34, 12, 40);
  g.fillStyle = CREAM; g.beginPath(); g.moveTo(-6, 6); g.lineTo(6, 6); g.lineTo(0, 18); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
function coin(g, x, y) {
  g.fillStyle = GOLD; g.strokeStyle = INK; g.lineWidth = 4.5;
  g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.stroke();
}
function parcel(g, x, y) {   // a box in brown paper, tied with string
  g.fillStyle = '#c9a06a'; g.strokeStyle = INK; g.lineWidth = 5;
  g.fillRect(x - 28, y - 22, 56, 44); g.strokeRect(x - 28, y - 22, 56, 44);
  g.strokeStyle = '#b85a4a'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(x, y - 22); g.lineTo(x, y + 22); g.moveTo(x - 28, y); g.lineTo(x + 28, y); g.stroke();
}
function receipt(g, x, y) {   // a paper slip with a torn foot and a few printed lines
  g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.moveTo(x - 22, y - 30); g.lineTo(x + 22, y - 30); g.lineTo(x + 22, y + 26);
  for (let k = 0; k <= 4; k++) g.lineTo(x + 22 - k * 11, y + (k % 2 ? 32 : 26));
  g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 3.5;
  for (const [dy, w] of [[-16, 28], [-4, 28], [8, 16]]) { g.beginPath(); g.moveTo(x - 14, y + dy); g.lineTo(x - 14 + w, y + dy); g.stroke(); }
}
function sweat(g, x, y, s = 1) {
  g.fillStyle = '#8fc3e6'; g.strokeStyle = INK; g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(x, y - 12 * s); g.quadraticCurveTo(x + 9 * s, y + 2 * s, x, y + 6 * s); g.quadraticCurveTo(x - 9 * s, y + 2 * s, x, y - 12 * s); g.fill(); g.stroke();
}

const DRAW = {
  wifi: (g) => { wifi(g, CX - 18, CY + 22); text(g, '?', CX + 44, CY, 56); },           // "what's the Wi-Fi password?"
  password: (g) => { wifi(g, CX - 52, CY + 16, 0.6); text(g, '****', CX + 20, CY + 12, 48); },   // the answer, from memory
  coffee: (g) => { cup(g, CX - 14, CY + 6); text(g, '?', CX + 46, CY, 50); },
  towel: (g) => { towel(g, CX - 14, CY + 4); text(g, '?', CX + 50, CY, 50); },
  letter: (g) => envelope(g, CX, CY + 4, true),       // a sealed letter: the request is private
  opened: (g) => envelope(g, CX, CY + 12, false),     // opened at the desk
  wait: (g) => { text(g, '. . .', CX, CY + 2, 44); },
  ok: (g) => { g.strokeStyle = '#2f7d5b'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(CX - 28, CY + 2); g.lineTo(CX - 6, CY + 22); g.lineTo(CX + 30, CY - 20); g.stroke(); },
  forbidden: (g) => { text(g, '403', CX, CY + 4, 54, RED); },
  lost: (g) => { text(g, '?', CX, CY + 4, 70); },
  angry: (g) => { text(g, '!!', CX, CY + 4, 64, RED); },
  gold: (g) => sack(g, CX, CY + 2),
  thief: (g) => { sack(g, CX - 14, CY + 4); text(g, '?', CX + 50, CY, 50); },     // the thief, asking nicely
  moved: (g) => { text(g, '→', CX, CY + 2, 70); },
  evil: (g) => evilFace(g, CX, CY + 10),                                             // "heh heh heh"
  yum: (g) => yumFace(g, CX, CY + 2),
  happy: (g) => happyFace(g, CX, CY + 2),
  panic: (g) => { text(g, '!?', CX - 4, CY + 4, 62, RED); sweat(g, CX + 46, CY - 12); sweat(g, CX - 50, CY + 4, 0.8); },
  wrench: (g) => { wrench(g, CX - 14, CY + 4); text(g, '!', CX + 46, CY, 56, RED); },      // "maintenance, please"
  melted: (g) => { meltedLolly(g, CX - 10, CY - 2); text(g, '!', CX + 50, CY - 6, 50, RED); },
  note: (g) => note(g, CX - 10, CY + 4),                                             // writing a note on the clipboard
  reset: (g) => { bolt(g, CX - 16, CY + 2); text(g, '?', CX + 44, CY, 56); },      // throwing the breaker back on: will the power hold?
  oneBox: (g) => {   // one little box: a whole trip for a single lolly
    g.fillStyle = '#c9a06a'; g.strokeStyle = INK; g.lineWidth = 5;
    g.fillRect(CX - 56, CY - 22, 50, 46); g.strokeRect(CX - 56, CY - 22, 50, 46);
    g.beginPath(); g.moveTo(CX - 56, CY - 8); g.lineTo(CX - 6, CY - 8); g.stroke();
    text(g, '×1', CX + 30, CY + 4, 50);
  },
  // the post office (world 5)
  shrug: (g) => { text(g, '¯\\_(?)_/¯', CX, CY + 4, 40); },                            // no reply: no idea
  resend: (g) => {   // a looping arrow round a capsule: send it again
    g.strokeStyle = INK; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.arc(CX, CY + 4, 30, -Math.PI * 0.2, Math.PI * 1.45); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(CX + 36, CY - 26); g.lineTo(CX + 16, CY - 22); g.lineTo(CX + 32, CY - 6); g.closePath(); g.fill();
    g.fillStyle = GOLD; g.lineWidth = 4; g.beginPath(); g.roundRect(CX - 16, CY - 6, 32, 20, 9); g.fill(); g.stroke();
  },
  twice: (g) => { coin(g, CX - 40, CY + 2); coin(g, CX - 10, CY + 2); text(g, '×2', CX + 44, CY + 4, 46, RED); },   // charged twice
  stamp: (g) => {   // a red rubber-stamp mark: already done
    g.save(); g.translate(CX, CY + 4); g.rotate(-0.12);
    g.font = '900 34px system-ui, sans-serif';
    const words = Math.min(g.measureText('SENT ✓').width, 112), frame = words + 24;   // the frame hugs the words, and stays inside the bubble
    g.strokeStyle = RED; g.lineWidth = 6; g.strokeRect(-frame / 2, -26, frame, 52);
    text(g, 'SENT ✓', 0, 2, 34 * words / g.measureText('SENT ✓').width, RED);
    g.restore();
  },
  parcelQ: (g) => { parcel(g, CX - 18, CY + 4); text(g, '?', CX + 48, CY, 54); },          // where's my parcel?
  dupe: (g) => { g.save(); g.scale(0.8, 0.8); parcel(g, (CX - 42) / 0.8, (CY + 16) / 0.8); parcel(g, (CX - 30) / 0.8, (CY - 14) / 0.8); g.restore(); text(g, '×2', CX + 40, CY + 4, 46, RED); },   // the same parcel, twice
  receiptQ: (g) => { receipt(g, CX - 18, CY + 2); text(g, '?', CX + 44, CY, 54); },        // did it go?
  bang: (g) => {   // a jagged burst: the shutter slamming
    g.fillStyle = GOLD; g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath();
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, r = k % 2 ? 22 : 44; g.lineTo(CX + Math.cos(a) * r * 1.3, CY + 4 + Math.sin(a) * r * 0.85); }
    g.closePath(); g.fill(); g.stroke();
    text(g, '!', CX, CY + 6, 50, RED);
  },
  // the igloo archive (World 6)
  unavailable: (g) => { text(g, '503', CX, CY + 4, 54, RED); },                       // the igloo that holds your record is down
  noFile: (g) => { folder(g, CX - 16, CY + 6); text(g, '?', CX + 46, CY, 56); },    // "your file isn't here (yet)"
  gotFile: (g) => { folder(g, CX - 16, CY + 6); tick(g, CX + 44, CY + 2); },         // served: here's your file
  hot: (g) => { sweat(g, CX - 30, CY - 4, 1.6); sweat(g, CX + 4, CY + 14, 1.3); sweat(g, CX + 36, CY - 8, 1.1); },   // a crowd this size is warm work
  tossBox: (g) => {   // a box of files flying in an arc: records moving between igloos, so wait
    g.save(); g.scale(0.62, 0.62); fileBox(g, (CX + 30) / 0.62, (CY + 14) / 0.62); g.restore();
    g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'; g.setLineDash([9, 8]);
    g.beginPath(); g.moveTo(CX - 52, CY + 26); g.quadraticCurveTo(CX - 20, CY - 44, CX + 18, CY - 6); g.stroke(); g.setLineDash([]);
  },
  full: (g) => { text(g, 'FULL', CX, CY + 4, 44, RED); },                               // the gate's queue is full: come back later
  // the office (World 7)
  roomFree: (g) => screenTag(g, 'FREE', '#7fcf8e'),                                         // the room's screen, as the lead read it
  roomTaken: (g) => screenTag(g, 'BOOKED', '#e6c77a'),
  taken: (g) => { text(g, 'TAKEN', CX, CY + 4, 42, RED); },                                // the panel refused the booking
  deadRoom: (g) => { clockFace(g, CX - 22, CY + 4); text(g, '?', CX + 46, CY, 54, RED); },  // booked ages ago, and nobody in it
  come: (g) => {   // "come on, we've got a room": a beckoning arrow
    g.strokeStyle = INK; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(CX - 44, CY + 20); g.quadraticCurveTo(CX - 10, CY - 34, CX + 36, CY - 4); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(CX + 50, CY + 4); g.lineTo(CX + 22, CY + 10); g.lineTo(CX + 38, CY - 20); g.closePath(); g.fill();
  },
  bell: (g) => {   // the team's bell, rung: something shipped
    g.fillStyle = GOLD; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(CX - 34, CY + 22); g.quadraticCurveTo(CX - 30, CY - 26, CX, CY - 28); g.quadraticCurveTo(CX + 30, CY - 26, CX + 34, CY + 22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8c6448'; g.fillRect(CX - 44, CY + 22, 88, 10); g.strokeRect(CX - 44, CY + 22, 88, 10);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(CX + s * 44, CY - 22); g.lineTo(CX + s * 58, CY - 34); g.moveTo(CX + s * 48, CY - 6); g.lineTo(CX + s * 64, CY - 8); g.stroke(); }
  },
  home: (g) => {   // working from home
    g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(CX - 36, CY - 4); g.lineTo(CX, CY - 34); g.lineTo(CX + 36, CY - 4); g.lineTo(CX + 28, CY - 4); g.lineTo(CX + 28, CY + 28); g.lineTo(CX - 28, CY + 28); g.lineTo(CX - 28, CY - 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#b85a4a'; g.fillRect(CX - 8, CY + 6, 16, 22); g.strokeRect(CX - 8, CY + 6, 16, 22);
  },
  wake: (g) => { text(g, '!', CX - 14, CY + 4, 62, RED); text(g, 'z', CX + 30, CY - 6, 34, '#8a8f99'); },   // awake with a start
};
function screenTag(g, word, colour) {   // a little booking screen with one word on it
  g.fillStyle = '#10201c'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.roundRect(CX - 62, CY - 26, 124, 56, 10); g.fill(); g.stroke();
  text(g, word, CX, CY + 3, word.length > 4 ? 30 : 38, colour);
}
function clockFace(g, x, y) {
  g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 20); g.moveTo(x, y); g.lineTo(x + 14, y + 6); g.stroke();
}
// A name tag with a big initial, for each letter: what a visitor shows the gatekeeper.
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') DRAW[`name${ch}`] = (g) => nameTag(g, ch, CX, CY + 2);

function nameTag(g, ch, x, y) {   // a luggage tag on a string, the initial on it
  g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = CREAM;
  g.beginPath(); g.moveTo(x - 30, y - 30); g.lineTo(x + 38, y - 30); g.lineTo(x + 38, y + 30); g.lineTo(x - 30, y + 30); g.lineTo(x - 46, y); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 32, y, 5, 0, Math.PI * 2); g.fill(); g.stroke();
  text(g, ch, x + 6, y + 3, 50);
}
function folder(g, x, y) {   // a manila folder, a paper peeking out of it
  g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#f3efe4';
  g.beginPath(); g.rect(x - 22, y - 30, 40, 30); g.fill(); g.stroke();
  g.fillStyle = '#e3b95c';
  g.beginPath(); g.moveTo(x - 30, y - 18); g.lineTo(x - 30, y + 26); g.lineTo(x + 30, y + 26); g.lineTo(x + 30, y - 18);
  g.lineTo(x + 2, y - 18); g.lineTo(x - 4, y - 26); g.lineTo(x - 24, y - 26); g.lineTo(x - 30, y - 18); g.closePath(); g.fill(); g.stroke();
}
function fileBox(g, x, y) {   // a record: a cardboard archive box, papers peeking out, a label on the end
  g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#f3efe4';
  g.beginPath(); g.rect(x - 24, y - 34, 18, 16); g.rect(x + 2, y - 30, 18, 12); g.fill(); g.stroke();
  g.fillStyle = '#c9a06a';
  g.beginPath(); g.rect(x - 32, y - 20, 64, 46); g.fill(); g.stroke();
  g.fillStyle = '#f7f2e3'; g.lineWidth = 3.5;
  g.beginPath(); g.rect(x - 18, y - 6, 36, 18); g.fill(); g.stroke();
}
function tick(g, x, y) {
  g.strokeStyle = '#2f7d5b'; g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 16, y + 2); g.lineTo(x - 4, y + 14); g.lineTo(x + 16, y - 14); g.stroke();
}
export const BUBBLES = Object.keys(DRAW);

export function bubbleTexture(key) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    bubble(g);
    DRAW[key](g);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, t);
  }
  return cache.get(key);
}
