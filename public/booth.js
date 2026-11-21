// The booth, seen from the inspector's chair: the window, the traveller beyond
// it, and the desk with its tools (papers, scratchpad, microphone, two stamps).
// Built from the Fang Street penguin cast (ADR-6), loaded through the page's
// import map (ADR-7). Screen only: the booth shows what it is told and reports
// what was clicked; every rule is decided in app.js and src/rules.js.
import * as THREE from 'three';
import { createEngine, part, box, ball, mat, mapMat, textPlane } from '/penguins/engine.js';
import { makePenguin } from '/penguins/penguin.js';
import { buildScenery } from '/scenery.js';
import { FORM_TITLE, NOTICES, RULE_SPOT, TIN_LABEL } from '/notices.js';
import { getTraveller } from '/src/travellers/index.js';

const COLORS = {
  booth: '#8fb3a8', inside: '#c9d6d0', floor: '#7d8a8f', frame: '#e8e2d4', desk: '#754a32',
  paper: '#f4efe2', cover: '#3f6e8c', micBody: '#343845', micGrille: '#5a5f6b', wood: '#8c6448',
  through: '#3f8f5a', away: '#c0453a', live: '#d8433a', off: '#6b6f78',
};
const INK = '#1f2126';
const TYPEWRITER = '"American Typewriter", "Courier New", monospace';
const HANDWRITING = '"Noteworthy", "Bradley Hand", "Marker Felt", cursive';
const TERMINAL = 'Menlo, "Courier New", monospace';
const AMBER = '#f2b544';
const BRASS = '#c4a46b';
const BRASS_DARK = '#80613b';


// One face per mood, the same for every traveller, so the face is a fair tell.
const FACES = {
  neutral: { expression: 'neutral' },
  confident: { expression: 'evil' },               // the sly grin: got away with it
  happy: { expression: 'happy' },
  excited: { expression: 'happy', panicking: true }, // flapping and hopping
  frustrated: { expression: 'annoyed', footTap: true },
  sad: { expression: 'neutral', chinDown: true },
};
const STAMP_WORDS = { through: 'THROUGH', away: 'TURNED AWAY' };

const SILL = 1.0;
// The window view (SPEC "Looking around the booth"): the camera at the
// traveller's eye level, face to face. He stands on a step so his upper body
// clears the sill; the desk sits above the subtitles and the toolbar.
const FRAMING = {
  eye: new THREE.Vector3(0, 1.5, 2.25),
  lookAt: new THREE.Vector3(0, 1.08, -1.1),
  fov: 50,
  step: 0.22,
};
const TRAVELLER_AT = new THREE.Vector3(0, FRAMING.step, -1.1);
const EYE = FRAMING.eye;
const LOOK_AT = FRAMING.lookAt;
// Held papers fill the same share of the screen whatever the field of view,
// raised a little so they clear the subtitles.
const READ_HEIGHT = 0.745;
const READ_DISTANCE = READ_HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(FRAMING.fov / 2)));
const READ_RAISE = READ_DISTANCE * 0.072;
const WALK_OFF_X = 3.2;
const SIDE_WALL_X = 1.85;
const BOOTH_DEPTH = 4.6;   // deep enough that a side view never sees past the back wall

// Three ways to face (SPEC "Looking around the booth"): the computer on the
// left wall, the window, and the notice board on the right wall.
const VIEWS = { left: Math.PI / 2, window: 0, right: -Math.PI / 2 };
const VIEW_ORDER = ['left', 'window', 'right'];
const UP = new THREE.Vector3(0, 1, 0);

// ---------- drawing the papers and the scratchpad ----------

function wrap(g, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawPapers(g, w, h, papers, stamp) {
  g.fillStyle = COLORS.paper; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9bfa8'; g.lineWidth = w * 0.006; g.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94);
  g.fillStyle = INK; g.textAlign = 'center';
  g.font = `bold ${w * 0.07}px ${TYPEWRITER}`;
  g.fillText('TRAVEL PAPERS', w / 2, h * 0.11);
  g.textAlign = 'left';
  let y = h * 0.21;
  for (const [label, value] of Object.entries(papers ?? {})) {
    g.fillStyle = '#6b6457'; g.font = `${w * 0.04}px ${TYPEWRITER}`;
    g.fillText(label.toUpperCase(), w * 0.09, y);
    g.fillStyle = INK; g.font = `${w * 0.055}px ${TYPEWRITER}`;
    for (const line of wrap(g, value, w * 0.82)) {
      y += h * 0.05;
      g.fillText(line, w * 0.09, y);
    }
    y += h * 0.075;
  }
  if (stamp) {
    g.save();
    g.translate(w * 0.55, h * 0.8); g.rotate(-0.2);
    g.strokeStyle = g.fillStyle = COLORS[stamp]; g.globalAlpha = 0.85;
    g.lineWidth = w * 0.014;
    g.font = `bold ${w * 0.085}px ${TYPEWRITER}`; g.textAlign = 'center';
    const width = g.measureText(STAMP_WORDS[stamp]).width + w * 0.08;
    g.strokeRect(-width / 2, -h * 0.055, width, h * 0.1);
    g.fillText(STAMP_WORDS[stamp], 0, h * 0.025);
    g.restore();
  }
}

function drawNotes(g, w, h, name, notes) {
  g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c8d8e4'; g.lineWidth = w * 0.003;
  for (let y = h * 0.2; y < h; y += h * 0.075) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = '#e3a3a3'; g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.1, h); g.stroke();
  g.fillStyle = INK; g.font = `${w * 0.06}px ${HANDWRITING}`;
  g.fillText(`Notes: ${name ?? ''}`, w * 0.14, h * 0.13);
  g.fillStyle = '#28406b'; g.font = `${w * 0.045}px ${HANDWRITING}`;
  let y = h * 0.2 - h * 0.015;
  const items = notes?.length ? notes : ['Nothing noted yet.'];
  for (const note of items) {
    for (const [i, line] of wrap(g, note, w * 0.8).entries()) {
      y += h * 0.075;
      if (y > h * 0.97) return;
      g.fillText(`${i === 0 ? '- ' : '  '}${line}`, w * 0.13, y);
    }
  }
}

function drawLabel(g, w, h, text, colour) {
  g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
  g.fillStyle = colour; g.font = `bold ${h * 0.5}px ${TYPEWRITER}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h * 0.54, w * 0.9);
}

// ---------- building the booth ----------

function deskWood() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const g = canvas.getContext('2d');
  const board = canvas.height / 4;
  for (let plank = 0; plank < 4; plank += 1) {
    const y = plank * board;
    const wash = g.createLinearGradient(0, y, 0, y + board);
    wash.addColorStop(0, plank % 2 ? '#865236' : '#9c6240');
    wash.addColorStop(0.5, plank % 2 ? '#a3663f' : '#b87748');
    wash.addColorStop(1, plank % 2 ? '#7e4d34' : '#995e3c');
    g.fillStyle = wash; g.fillRect(0, y, canvas.width, board);
    for (let line = 0; line < 25; line += 1) {
      const start = y + ((line * 47 + plank * 29) % board);
      g.beginPath();
      for (let x = 0; x <= canvas.width; x += 32) {
        const bend = Math.sin(x * 0.013 + line * 1.8) * (1.4 + line % 3);
        const drift = Math.sin(x * 0.004 + line * 0.7) * 2;
        if (x === 0) g.moveTo(x, start + bend + drift);
        else g.lineTo(x, start + bend + drift);
      }
      g.strokeStyle = line % 4 ? '#4328174d' : '#e9b68452';
      g.lineWidth = line % 5 ? 1 : 2;
      g.stroke();
    }
    if (plank) {
      g.fillStyle = '#442b1e91'; g.fillRect(0, y - 2, canvas.width, 3);
      g.fillStyle = '#dca57870'; g.fillRect(0, y + 1, canvas.width, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return mapMat(texture);
}

function buildRoom(group, wood) {
  const wall = mat(COLORS.booth);
  const [top, half] = [2.3, 1.15];
  part(box(6, SILL, 0.16), wall, group, [0, SILL / 2, 0]);
  part(box(6, 3.4 - top, 0.16), wall, group, [0, (3.4 + top) / 2, 0]);
  for (const s of [-1, 1]) part(box(3 - half, top - SILL, 0.16), wall, group, [s * (3 + half) / 2, (SILL + top) / 2, 0]);
  const frame = mat(COLORS.frame);
  part(box(half * 2 + 0.16, 0.08, 0.24), frame, group, [0, SILL, 0]);
  part(box(half * 2 + 0.16, 0.08, 0.24), frame, group, [0, top, 0]);
  for (const s of [-1, 1]) part(box(0.08, top - SILL, 0.24), frame, group, [s * half, (SILL + top) / 2, 0]);
  part(box(3.4, 0.1, 1.4, 0.04), wood, group, [0, SILL - 0.05, 0.75]);
  part(box(3.3, SILL - 0.1, 1.3, 0.04), mat(COLORS.desk), group, [0, (SILL - 0.1) / 2, 0.75]);
  // Fine inlay and a dark lower edge give the broad desk a readable silhouette.
  part(box(3.26, 0.012, 0.012, 0.004), mat(BRASS), group, [0, SILL - 0.019, 1.435], undefined, undefined, false);
  part(box(3.25, 0.035, 0.025, 0.006), mat('#533322'), group, [0, SILL - 0.09, 1.41], undefined, undefined, false);
  // The inside of the booth, for turning to the left and right walls.
  for (const s of [-1, 1]) part(box(0.16, 3.4, BOOTH_DEPTH), mat(COLORS.inside), group, [s * SIDE_WALL_X, 1.7, BOOTH_DEPTH / 2]);
  part(box(SIDE_WALL_X * 2, 0.1, BOOTH_DEPTH), mat(COLORS.floor), group, [0, -0.05, BOOTH_DEPTH / 2]);
  part(box(SIDE_WALL_X * 2, 3.4, 0.16), mat(COLORS.inside), group, [0, 1.7, BOOTH_DEPTH]);
  // The booth throws no shadow outside, or the traveller would stand in the dark.
  group.traverse((o) => { o.castShadow = false; });
}

// A flat thing on the desk that can be lifted up to the eyes. Its face is
// local +z, so lying down is a quarter turn back about x (tilt -π/2).
function liftable(group, name, at, yaw, deskScale, tilt = -Math.PI / 2) {
  const holder = new THREE.Group();
  holder.userData.tool = name;
  group.add(holder);
  const desk = { position: at.clone(), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, yaw, 'XYZ')), scale: deskScale };
  return { name, holder, desk, t: 0 };
}

function buildPapers(group) {
  const item = liftable(group, 'papers', new THREE.Vector3(-0.28, SILL + 0.012, 0.5), -0.06, 0.7);
  for (const [x, y, z] of [[-0.008, -0.007, -0.004], [0.006, -0.004, -0.002]]) {
    const under = part(box(0.42, 0.56, 0.004, 0.002), mat('#d7ccba'), item.holder, [x, y, z], undefined, undefined, false);
    under.castShadow = under.receiveShadow = false;
  }
  // A sheet is a thin part (ART-DIRECTION section 1): no ink hull, which framed
  // it in thick black when held up, and no shadow, which left a dark patch on the desk.
  const sheet = part(box(0.42, 0.56, 0.008, 0.004), mat(COLORS.paper), item.holder, undefined, undefined, undefined, false);
  sheet.castShadow = sheet.receiveShadow = false;
  const print = textPlane(0.42, 0.56, drawPapers, 2048);
  print.mesh.position.z = 0.006;
  item.holder.add(print.mesh);
  item.redraw = print.redraw;
  return item;
}

function buildNotebook(group) {
  const item = liftable(group, 'notebook', new THREE.Vector3(-0.88, SILL + 0.02, 0.5), 0.18, 0.6);
  item.cover = part(box(0.42, 0.56, 0.03, 0.01), mat(COLORS.cover), item.holder);
  part(box(0.035, 0.54, 0.035, 0.008), mat('#294b62'), item.cover, [-0.19, 0, 0.004], undefined, undefined, false);
  for (const y of [-0.19, 0, 0.19]) {
    part(ball(0.008, 8, 6), mat(BRASS), item.cover, [-0.19, y, 0.024], undefined, undefined, false);
  }
  for (const x of [-0.17, 0.17]) {
    part(box(0.035, 0.045, 0.006, 0.002), mat(BRASS), item.cover, [x, 0.24, 0.019], undefined, undefined, false);
  }
  const label = textPlane(0.3, 0.08, (g, w, h) => drawLabel(g, w, h, 'SCRATCHPAD', INK), 1024);
  label.redraw();
  label.mesh.position.set(0, 0.12, 0.017);
  item.cover.add(label.mesh);
  const page = textPlane(0.42, 0.56, drawNotes, 2048);
  page.mesh.position.z = 0.017;
  page.mesh.visible = false;
  item.holder.add(page.mesh);
  item.page = page.mesh;
  item.redraw = page.redraw;
  return item;
}

// ---------- the transcript (Shahil 13:40, 15:00) ----------
// The conversation prints like a till receipt: a printer at the front left of
// the desk feeds the paper up one notch per printed line, newest line by the
// printer. The paper grows to five lines and no further, so it stays below the
// scratchpad and papers and never reaches anything; older lines roll over the
// top. It leans back only part way and faces straight ahead (turned, its lines
// slant), so the newest lines read from the chair. Clicking lifts a full page of the conversation.
const SLIP = {
  width: 0.54, row: 0.03, rows: 5, pad: 0.014, tilt: -0.7,
  bottom: new THREE.Vector3(-0.36, SILL + 0.03, 1.32),
};
const SLIP_PX = 2000;      // canvas pixels per metre of paper
const ROLL_ROWS = 48;      // printed rows the canvas keeps; only the last few show
const NOTCH_SECONDS = 0.16;
const SAID_BY_YOU = '#6b6457';

// Every line of the conversation as printed rows: [text, colour, bold].
function transcriptRows(g, name, lines, maxWidth, size) {
  const rows = [];
  g.font = `bold ${size}px ${TYPEWRITER}`;
  rows.push([`TRANSCRIPT: ${name ?? ''}`, SAID_BY_YOU, true]);
  g.font = `${size}px ${TYPEWRITER}`;
  for (const { who, text } of lines) {
    const colour = who === 'You' ? SAID_BY_YOU : INK;
    wrap(g, `${who}: ${text}`, maxWidth).forEach((row, i) => rows.push([i ? `   ${row}` : row, colour, false]));
  }
  return rows;
}

function printRow(g, [text, colour, bold], x, y, size) {
  g.fillStyle = colour; g.font = `${bold ? 'bold ' : ''}${size}px ${TYPEWRITER}`;
  g.fillText(text, x, y);
}

// The roll: every printed row top to bottom, one row per SLIP.row of paper.
function drawRoll(g, w, h, rows) {
  g.fillStyle = COLORS.paper; g.fillRect(0, 0, w, h);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const rowPx = SLIP.row * SLIP_PX;
  rows.forEach((row, i) => printRow(g, row, w * 0.04, SLIP.pad * SLIP_PX + (i + 0.8) * rowPx, rowPx * 0.78));
}

// Lifted: the whole conversation on a page, oldest at the top. If a long
// shift overflows the page, the oldest lines give way.
function drawTranscriptPage(g, w, h, name, lines = []) {
  g.fillStyle = COLORS.paper; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9bfa8'; g.lineWidth = w * 0.006; g.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94);
  const size = w * 0.042;
  const step = size * 1.3;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const rows = transcriptRows(g, name, lines, w * 0.82, size);
  const fit = Math.floor((h * 0.9) / step);
  const shown = rows.length > fit ? [rows[0], ['   …', SAID_BY_YOU, false], ...rows.slice(rows.length - fit + 2)] : rows;
  shown.forEach((row, i) => printRow(g, row, w * 0.09, h * 0.09 + i * step, size));
}

function buildTranscript(group) {
  const item = liftable(group, 'transcript', SLIP.bottom, 0, 1, SLIP.tilt);
  // The paper's bottom edge sits in the printer; it grows upwards as it feeds.
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(SLIP.width * SLIP_PX);
  canvas.height = Math.round((ROLL_ROWS * SLIP.row + SLIP.pad * 2) * SLIP_PX);
  const roll = new THREE.CanvasTexture(canvas);
  roll.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.PlaneGeometry(SLIP.width, 1);
  geometry.translate(0, 0.5, 0);
  const slip = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: roll }));
  slip.userData.isScreen = true;   // flat print: no crease lines inside it
  item.holder.add(slip);
  const page = textPlane(0.42, 0.56, drawTranscriptPage, 2048);
  page.mesh.visible = false;
  item.holder.add(page.mesh);

  let traveller = null;
  let firstRow = 0;   // the roll keeps the last ROLL_ROWS rows; this is the first one's number
  let printed = 0;    // rows the conversation has
  let fed = 0;        // rows fed out so far: eases up one notch at a time towards printed
  function redraw(name, lines) {
    const g = canvas.getContext('2d');
    const rows = transcriptRows(g, name, lines, canvas.width * 0.92, SLIP.row * SLIP_PX * 0.78);
    if (name !== traveller) fed = 0;   // a fresh roll for each traveller
    else fed = Math.min(fed, rows.length);   // an uncounted question drops its line
    traveller = name;
    printed = rows.length;
    firstRow = Math.max(0, rows.length - ROLL_ROWS);
    drawRoll(g, canvas.width, canvas.height, rows.slice(firstRow));
    roll.needsUpdate = true;
    page.redraw(name, lines);
  }
  // Every frame: feed towards the printed rows, then show the paper from the
  // roll's top (or, once it's full, from a line SLIP.rows back) down to just
  // past the last row fed, as a strip growing out of the printer.
  function feed(dt) {
    fed = Math.min(printed, fed + dt / NOTCH_SECONDS);
    const shown = Math.floor(fed) + ease(fed % 1) - firstRow;
    const height = Math.min(SLIP.pad + shown * SLIP.row, SLIP.rows * SLIP.row) + SLIP.pad;
    slip.scale.y = height;
    const bottomPx = (SLIP.pad * 2 + shown * SLIP.row) * SLIP_PX;
    roll.repeat.y = (height * SLIP_PX) / canvas.height;
    roll.offset.y = 1 - bottomPx / canvas.height;
  }
  Object.assign(item, { slip, page: page.mesh, redraw, feed });
  item.redraw('', []);
  // The printer it feeds out of; clicking the printer lifts the paper too.
  const printer = new THREE.Group();
  printer.userData.tool = 'transcript';
  printer.position.copy(SLIP.bottom);
  group.add(printer);
  // A thin part (ART-DIRECTION section 1): no ink hull, which drew a line across the paper.
  part(box(SLIP.width + 0.04, 0.03, 0.07, 0.01), mat(COLORS.micBody), printer, [0, -0.015, 0.015], undefined, undefined, false);
  part(box(SLIP.width - 0.04, 0.006, 0.008, 0.003), mat(BRASS), printer, [0, 0.002, 0.047], undefined, undefined, false);
  return { item, printer };
}

// A bribe on the window ledge (PR #3): what the traveller slid across, shown
// only while it's on offer. Click it to pocket it.
const LEDGE = new THREE.Vector3(-0.62, SILL + 0.04, 0.04);
function buildBribe(group) {
  const holder = new THREE.Group();
  holder.userData.tool = 'bribe';
  holder.position.copy(LEDGE);
  holder.scale.setScalar(1.9);   // big enough to read from the chair
  holder.visible = false;
  group.add(holder);
  const croissant = new THREE.Group();
  part(new THREE.TorusGeometry(0.06, 0.028, 10, 18, Math.PI * 1.25), mat('#d9a04a'), croissant, [0, 0.03, 0], [-Math.PI / 2, 0, 0.6]);
  const cheese = new THREE.Group();
  // Stood on its long edge with its cut face to the inspector: lying flat, it was
  // a thin yellow sliver from the chair.
  part(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10, 1, false, Math.PI / 2, Math.PI / 3), mat('#e8c95a'), cheese, [-0.05, 0.002, 0], [Math.PI / 2, 0, 0]);
  const sticker = textPlane(0.11, 0.11, (g, w, h) => {
    g.fillStyle = '#e8743b'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fbf8ef'; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = (i % 2 ? 0.17 : 0.38) * w;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a));
    }
    g.fill();
  }, 512);
  sticker.redraw();
  sticker.mesh.position.set(0, 0.06, -0.05);
  sticker.mesh.rotation.x = -0.35;   // propped against the glass, facing the inspector
  const items = { croissant, cheese, sticker: sticker.mesh };
  for (const item of Object.values(items)) holder.add(item);
  return {
    holder,
    show(name) {
      holder.visible = Boolean(items[name]);
      for (const [key, item] of Object.entries(items)) item.visible = key === name;
    },
  };
}

function buildMic(group) {
  const holder = new THREE.Group();
  holder.userData.tool = 'mic';
  holder.position.set(0.28, SILL, 0.32);
  group.add(holder);
  part(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 20), mat(COLORS.micBody), holder, [0, 0.015, 0]);
  part(new THREE.CylinderGeometry(0.07, 0.085, 0.006, 20), mat(BRASS_DARK), holder, [0, 0.033, 0], undefined, undefined, false);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), mat(COLORS.micGrille), holder, [0, 0.13, 0], [0.35, 0, 0]);
  part(ball(0.05, 16, 12), mat(COLORS.micGrille), holder, [0, 0.25, -0.04], [0, 0, 0], [1, 1.3, 1]);
  part(new THREE.TorusGeometry(0.044, 0.004, 6, 20), mat(BRASS), holder, [0, 0.215, -0.04], [Math.PI / 2, 0, 0], undefined, false);
  part(new THREE.TorusGeometry(0.044, 0.004, 6, 20), mat(BRASS), holder, [0, 0.28, -0.04], [Math.PI / 2, 0, 0], undefined, false);
  // Its own material: shared materials are cached by colour, so tinting one would tint them all.
  const light = new THREE.MeshBasicMaterial({ color: COLORS.off });
  part(ball(0.018, 10, 8), light, holder, [0.07, 0.035, 0.05]);
  const glow = new THREE.MeshBasicMaterial({ color: COLORS.live, transparent: true, opacity: 0.8, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 8, 32), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.035;
  ring.visible = false;
  ring.userData.noLines = true;
  holder.add(ring);
  return { holder, light, ring };
}

function buildThoughtBubble(group) {
  const bubble = textPlane(0.42, 0.28, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.lineWidth = w * 0.025;
    g.strokeStyle = INK;
    g.fillStyle = '#fbf8ef';
    g.beginPath();
    g.roundRect(w * 0.04, h * 0.04, w * 0.92, h * 0.72, h * 0.17);
    g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(w * 0.2, h * 0.76);
    g.lineTo(w * 0.12, h * 0.96);
    g.lineTo(w * 0.4, h * 0.76);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK;
    for (const x of [0.32, 0.5, 0.68]) {
      g.beginPath(); g.arc(w * x, h * 0.4, w * 0.045, 0, Math.PI * 2); g.fill();
    }
  }, 1024);
  bubble.redraw();
  bubble.mesh.visible = false;
  bubble.mesh.userData.noLines = true;
  group.add(bubble.mesh);
  return bubble.mesh;
}

// The inspector's computer on the left wall. Its screen lists the real
// Mistral calls, one line each (lines come from public/computer.js).
function drawComputer(g, w, h, lines = []) {
  g.fillStyle = '#14161a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2f4858'; g.fillRect(0, 0, w, h * 0.11);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = '#f4efe2'; g.font = `600 ${h * 0.055}px system-ui, sans-serif`;
  g.fillText('INSPECTOR TERMINAL  ·  live Mistral calls', w * 0.04, h * 0.058, w * 0.92);
  const row = h * 0.088;
  g.font = `${h * 0.046}px ${TERMINAL}`;
  if (!lines.length) {
    g.fillStyle = '#8a8f98';
    g.fillText('Waiting for the first question…', w * 0.04, h * 0.11 + row);
    return;
  }
  lines.forEach(({ who, what }, i) => {
    const y = h * 0.11 + row * (i + 0.9);
    const label = `${who} `;
    g.fillStyle = AMBER;
    g.fillText(label, w * 0.04, y);
    const x = w * 0.04 + g.measureText(label).width;
    g.fillStyle = '#e8e2d4';
    g.fillText(what, x, y, w * 0.96 - x);
  });
}

function buildSideDesk(group, x, inward, wood) {
  part(box(0.6, 0.95, 2.35, 0.03), mat(COLORS.desk), group, [x, 0.475, 2.72]);
  const top = box(0.62, 0.05, 2.37, 0.02);
  const uv = top.getAttribute('uv');
  // The side desks run along z; turn the shared wood map so its grain follows their long edge.
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getY(i), uv.getX(i));
  part(top, wood, group, [x, 0.97, 2.72]);
  part(box(0.012, 0.008, 2.28, 0.003), mat(BRASS), group, [x + inward * 0.29, 1.001, 2.72], undefined, undefined, false);
  part(box(0.025, 0.035, 2.28, 0.005), mat('#533322'), group, [x + inward * 0.3, 0.92, 2.72], undefined, undefined, false);
}

function buildComputer(group, wood) {
  const z = 2.25;   // straight ahead when the inspector turns left
  const wallX = -SIDE_WALL_X + 0.08;
  buildSideDesk(group, wallX + 0.3, 1, wood);
  part(box(0.06, 0.22, 0.12), mat(COLORS.micBody), group, [wallX + 0.16, 1.1, z]);
  part(box(0.05, 0.74, 1.14, 0.02), mat(COLORS.micBody), group, [wallX + 0.2, 1.4, z]);
  const screen = textPlane(1.06, 0.66, drawComputer, 1600);
  screen.redraw([]);
  screen.mesh.position.set(wallX + 0.23, 1.4, z);
  screen.mesh.rotation.y = Math.PI / 2;
  group.add(screen.mesh);
  part(box(0.18, 0.025, 0.5, 0.01), mat(COLORS.micGrille), group, [wallX + 0.42, 1.005, z]);
  part(ball(0.035, 12, 8), mat(COLORS.micGrille), group, [wallX + 0.42, 1.0, z + 0.4], [0, 0, 0], [1, 0.5, 1.4]);
  const note = textPlane(0.13, 0.13, (g, w, h) => {
    g.fillStyle = '#f2d96b'; g.fillRect(0, 0, w, h);
    g.fillStyle = INK; g.font = `${h * 0.17}px ${HANDWRITING}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText("Don't feed", w / 2, h * 0.38); g.fillText('the walrus', w / 2, h * 0.62);
  }, 1024);
  note.redraw();
  note.mesh.position.set(wallX + 0.235, 1.62, z + 0.62);
  note.mesh.rotation.set(0, Math.PI / 2, 0.08);
  group.add(note.mesh);
  return screen;
}

// The right wall: a notice board and the inspector's clutter. Flavour only; the
// words come from public/notices.js, which is tested to give nothing away.
const CORK = '#b98d5e';
const PIN = '#c0453a';
const NOTE_PAPER = { typed: '#fbf8ef', clipping: '#e6e1d3', sticky: '#f2d96b' };
const NOTE_SPOTS = [   // [x, y, width, height, tilt] as fractions of the board
  [0.03, 0.07, 0.36, 0.5, -0.02],
  [0.42, 0.06, 0.3, 0.42, 0.03],
  [0.07, 0.63, 0.25, 0.32, 0.04],
  [0.38, 0.55, 0.34, 0.4, -0.03],
  [0.73, 0.68, 0.24, 0.3, 0.02],
];

function drawPin(g, x, y, r) {
  g.fillStyle = PIN; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// A snapshot of this month's winner: a grey seal, pleased with himself.
function drawSeal(g, x, y, size) {
  g.fillStyle = '#dfe6ea'; g.fillRect(x - size, y - size * 0.8, size * 2, size * 1.6);
  g.fillStyle = '#7d8a8f';
  g.beginPath(); g.ellipse(x, y + size * 0.3, size * 0.75, size * 0.42, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + size * 0.38, y - size * 0.18, size * 0.32, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK;
  for (const dx of [0.28, 0.5]) { g.beginPath(); g.arc(x + size * dx, y - size * 0.24, size * 0.05, 0, Math.PI * 2); g.fill(); }
}

function drawNotice(g, w, h, { style, title, lines, picture, compact }, [x, y, nw, nh, tilt]) {
  const [width, height] = [nw * w, nh * h];
  g.save();
  g.translate(x * w + width / 2, y * h + height / 2); g.rotate(tilt); g.translate(-width / 2, -height / 2);
  g.fillStyle = NOTE_PAPER[style]; g.fillRect(0, 0, width, height);
  const pad = width * 0.07;
  const font = style === 'sticky' ? HANDWRITING : TYPEWRITER;
  g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'top';
  g.font = `bold ${h * (compact ? 0.043 : 0.058)}px ${style === 'clipping' ? 'Georgia, serif' : font}`;
  g.fillText(title, pad, pad * 1.2, width - pad * 2);
  if (style === 'clipping') g.fillRect(pad, pad * 1.2 + h * 0.072, width - pad * 2, h * 0.005);
  g.font = `${h * (compact ? 0.032 : 0.046)}px ${font}`;
  let lineY = pad * 1.2 + h * (compact ? 0.075 : 0.1);
  for (const text of lines) {
    for (const line of wrap(g, text, width - pad * 2)) {
      g.fillText(line, pad, lineY);
      lineY += h * (compact ? 0.041 : 0.058);
    }
  }
  if (picture === 'seal') drawSeal(g, width * 0.72, height * 0.68, height * 0.2);
  drawPin(g, width / 2, h * 0.025, h * 0.016);
  g.restore();
}

// The rule card's place (SPEC stretch 11): a pinned label over an empty patch.
function drawRuleSpot(g, w, h) {
  const [x, y, width, height] = [w * 0.75, h * 0.08, w * 0.22, h * 0.6];
  g.strokeStyle = '#6b4f33'; g.lineWidth = h * 0.006; g.setLineDash([h * 0.03, h * 0.02]);
  g.strokeRect(x, y, width, height);
  g.setLineDash([]);
  g.fillStyle = INK; g.font = `bold ${h * 0.05}px ${TYPEWRITER}`; g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillText(RULE_SPOT, x + width / 2, y + h * 0.04, width * 0.9);
}

function drawNoticeBoard(g, w, h) {
  g.fillStyle = CORK; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a57b4f';
  for (let i = 0; i < 400; i++) g.fillRect((i * 7919) % w, (i * 104729) % h, h * 0.006, h * 0.006);   // fixed speckle
  NOTICES.forEach((notice, i) => drawNotice(g, w, h, notice, NOTE_SPOTS[i]));
  drawRuleSpot(g, w, h);
}

function buildNoticeBoard(group, wallX, z) {
  part(box(0.04, 0.93, 1.58, 0.01), mat(COLORS.wood), group, [wallX - 0.02, 1.57, z]);
  const board = textPlane(1.5, 0.85, drawNoticeBoard, 1400);
  board.redraw();
  board.mesh.position.set(wallX - 0.045, 1.57, z);
  board.mesh.rotation.y = -Math.PI / 2;
  group.add(board.mesh);
}

// A sardine tin far too shallow to be a pen pot, used as one anyway.
function buildPenPot(group, at) {
  part(box(0.12, 0.04, 0.2, 0.02), mat('#b8bfc4'), group, [at.x, at.y + 0.02, at.z]);
  part(box(0.1, 0.004, 0.18), mat('#6b747a'), group, [at.x, at.y + 0.041, at.z], undefined, undefined, false);
  part(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), mat('#b8bfc4'), group, [at.x, at.y + 0.05, at.z + 0.1], [0, 0, Math.PI / 2]);
  for (const [dz, colour, lean] of [[-0.04, '#3f6e8c', 0.35], [0, INK, -0.2], [0.04, PIN, 0.15]]) {
    part(new THREE.CylinderGeometry(0.007, 0.007, 0.17, 8), mat(colour), group, [at.x, at.y + 0.1, at.z + dz], [lean, 0, 0.12]);
  }
  const label = textPlane(0.17, 0.034, (g, w, h) => {
    g.fillStyle = '#2f4858'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.font = `bold ${h * 0.7}px ${TYPEWRITER}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(TIN_LABEL, w / 2, h * 0.55, w * 0.9);
  }, 1024);
  label.redraw();
  label.mesh.position.set(at.x - 0.061, at.y + 0.02, at.z);
  label.mesh.rotation.y = -Math.PI / 2;
  group.add(label.mesh);
}

function buildMug(group, at) {
  part(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 18), mat(COLORS.frame), group, [at.x, at.y + 0.055, at.z]);
  part(new THREE.CylinderGeometry(0.044, 0.044, 0.005, 18), mat(COLORS.wood), group, [at.x, at.y + 0.106, at.z], undefined, undefined, false);
  part(new THREE.TorusGeometry(0.032, 0.01, 8, 16), mat(COLORS.frame), group, [at.x, at.y + 0.055, at.z + 0.05], [0, Math.PI / 2, 0], undefined, false);   // thin: no ink hull
}

function drawForm(g, w, h) {
  g.fillStyle = COLORS.paper; g.fillRect(0, 0, w, h);
  g.fillStyle = INK; g.font = `bold ${w * 0.075}px ${TYPEWRITER}`; g.textAlign = 'center';
  g.fillText(FORM_TITLE, w / 2, h * 0.1, w * 0.9);
  g.strokeStyle = '#b5ab96'; g.lineWidth = w * 0.006;
  for (let y = h * 0.2; y < h * 0.95; y += h * 0.08) { g.beginPath(); g.moveTo(w * 0.08, y); g.lineTo(w * 0.92, y); g.stroke(); }
}

// Flat sheets read with their top away from the inspector, who faces +x here.
function buildForms(group, at) {
  for (let i = 0; i < 7; i++) {
    const sheet = part(box(0.3, 0.006, 0.4, 0.002), mat(COLORS.paper), group, [at.x, at.y + 0.003 + i * 0.007, at.z], [0, Math.PI / 2 + (i % 3 - 1) * 0.06, 0], undefined, false);
    sheet.castShadow = sheet.receiveShadow = false;
  }
  const top = textPlane(0.3, 0.4, drawForm, 1024);
  top.redraw();
  top.mesh.position.set(at.x, at.y + 0.05, at.z);
  top.mesh.rotation.set(-Math.PI / 2, 0, -Math.PI / 2, 'XYZ');
  group.add(top.mesh);
}

function buildRightWall(group, wood) {
  const z = 2.25;   // straight ahead when the inspector turns right
  const wallX = SIDE_WALL_X - 0.08;
  buildSideDesk(group, wallX - 0.3, -1, wood);
  const top = 0.995;
  buildNoticeBoard(group, wallX, z);
  buildPenPot(group, new THREE.Vector3(wallX - 0.32, top, z - 0.15));
  buildMug(group, new THREE.Vector3(wallX - 0.38, top, z - 0.6));
  buildForms(group, new THREE.Vector3(wallX - 0.3, top, z + 0.45));
}

function buildStamp(group, verdict, x) {
  const holder = new THREE.Group();
  holder.userData.tool = `stamp-${verdict}`;
  holder.position.set(x, SILL, 0.42);
  group.add(holder);
  part(box(0.15, 0.012, 0.1, 0.004), mat('#312f2c'), holder, [0, 0.006, 0], undefined, undefined, false);
  part(box(0.16, 0.05, 0.11, 0.015), mat(COLORS[verdict]), holder, [0, 0.025, 0]);
  part(box(0.135, 0.009, 0.09, 0.003), mat(BRASS), holder, [0, 0.054, 0], undefined, undefined, false);
  part(new THREE.CylinderGeometry(0.025, 0.03, 0.12, 12), mat(COLORS.wood), holder, [0, 0.11, 0]);
  part(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 16), mat(BRASS_DARK), holder, [0, 0.064, 0], undefined, undefined, false);
  part(ball(0.045, 14, 10), mat(COLORS.wood), holder, [0, 0.19, 0]);
  part(new THREE.TorusGeometry(0.032, 0.004, 6, 16), mat(BRASS), holder, [0, 0.168, 0], [Math.PI / 2, 0, 0], undefined, false);
  const label = textPlane(0.22, 0.06, (g, w, h) => drawLabel(g, w, h, STAMP_WORDS[verdict], COLORS[verdict]), 1024);
  label.redraw();
  label.mesh.position.set(0, 0.03, 0.13);
  label.mesh.rotation.x = -0.9;
  holder.add(label.mesh);
  return { holder, home: holder.position.clone() };
}

function makeTraveller(id) {
  // Each traveller's file sets his single accessory, so he reads at a glance.
  const { scarf = false, ...look } = getTraveller(id)?.look ?? {};
  const penguin = makePenguin({ scarf });
  penguin.setLook(look);
  penguin.showHearts = false;   // hearts are for love (art direction); nobody here is in love
  return penguin;
}

// The officer who takes away anyone turned away (ADR-11): navy cap and vest,
// with POLICE across the cap, the part of him that shows above the window sill.
const POLICE_NAVY = '#263a5a';
function makePolice() {
  const officer = makePenguin();
  officer.setLook({ hat: 'cap', hatColor: POLICE_NAVY, vest: true });
  officer.looks.vestMat.color.set(POLICE_NAVY);
  officer.showHearts = false;
  const badge = textPlane(0.36, 0.1, (g, w, h) => {
    g.fillStyle = POLICE_NAVY; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.font = `bold ${h * 0.72}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('POLICE', w / 2, h * 0.55, w * 0.92);
  }, 1024);
  badge.redraw();
  badge.mesh.position.set(0, 0.33, 0.44);   // on the front of the crown, above the peak
  badge.mesh.rotation.x = -0.65;
  officer.looks.hats.cap.add(badge.mesh);
  return officer;
}

const ease = (t) => t * t * (3 - 2 * t);

// ---------- the booth ----------

// Returns null if this browser can't draw 3D; the page then shows plain papers instead.
export function createBooth(container, handlers = {}) {
  let engine;
  try {
    engine = createEngine(container);
  } catch {
    return null;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  engine.controls.enabled = false;   // the inspector sits still: no orbiting
  // The engine keeps an orbiting camera above the floor; even switched off, that
  // limit tips an eye-level camera up into a look-down when the world is set.
  engine.controls.minPolarAngle = 0;
  engine.controls.maxPolarAngle = Math.PI;
  engine.camera.fov = FRAMING.fov;
  const group = new THREE.Group();
  engine.scene.add(group);
  const wood = deskWood();
  buildRoom(group, wood);
  const arrivals = buildScenery(group);
  const dir = EYE.clone().sub(LOOK_AT);
  const fitHalfHeight = dir.length() * Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
  engine.setWorld({ group, camTarget: LOOK_AT, startDir: dir, fit: [1.7, fitHalfHeight], walls: { backWall: [], sideWall: [], wallAt: -99 } });

  const papers = buildPapers(group);
  const notebook = buildNotebook(group);
  const { item: transcript, printer } = buildTranscript(group);
  const liftables = [papers, notebook, transcript];
  const mic = buildMic(group);
  const computer = buildComputer(group, wood);
  buildRightWall(group, wood);
  const thoughtBubble = buildThoughtBubble(group);
  const bribe = buildBribe(group);
  const stamps = { through: buildStamp(group, 'through', 0.62), away: buildStamp(group, 'away', 0.88) };
  const tools = [papers.holder, notebook.holder, transcript.holder, printer, mic.holder, stamps.through.holder, stamps.away.holder];

  let lifted = null;
  let traveller = null;
  let travellerId = null;
  let leaving = null;
  let officer = null;
  let face = FACES.neutral;
  let talking = false;
  let thinking = false;
  let recording = false;
  let hovered = null;
  let micHeld = false;
  let stamping = false;
  const tweens = [];
  const clock = new THREE.Clock();

  // Runs step(progress) every frame for `seconds`, then resolves.
  const tween = (seconds, step) => new Promise((resolve) => tweens.push({ seconds, age: 0, step, resolve }));

  // ---- picking ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = engine.renderer.domElement;
  const shown = (object) => {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
  };
  function toolAt(event) {
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, engine.camera);
    // three's raycaster ignores visibility, so hidden parts (the transcript's
    // full page while the slip is down, a bribe not on offer) must be skipped,
    // or they catch the pointer meant for what's behind them.
    const hit = raycaster.intersectObjects([...tools, bribe.holder], true).find((h) => shown(h.object));
    for (let o = hit?.object; o; o = o.parent) if (o.userData.tool) return o.userData.tool;
    return null;
  }
  canvas.addEventListener('pointermove', (event) => {
    const tool = toolAt(event);
    if (tool === hovered) return;
    hovered = tool;
    canvas.style.cursor = tool ? 'pointer' : 'default';
    handlers.onHover?.(tool);
  });
  canvas.addEventListener('pointerdown', (event) => {
    const tool = toolAt(event);
    if (tool === 'mic') {
      micHeld = true;
      canvas.setPointerCapture(event.pointerId);
      handlers.onMicDown?.();
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (micHeld) {
      micHeld = false;
      handlers.onMicUp?.();
      return;
    }
    const tool = toolAt(event);
    if (tool === 'papers' || tool === 'notebook' || tool === 'transcript') booth.toggle(tool);
    else if (tool?.startsWith('stamp-')) handlers.onStampClick?.(tool.slice(6));
    else if (tool === 'bribe') handlers.onBribeClick?.();
    else if (lifted) booth.putDown();
  });

  // ---- every frame ----
  const deskPos = new THREE.Vector3();
  const readPos = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const upward = new THREE.Vector3();
  const baseForward = LOOK_AT.clone().sub(EYE).normalize();
  const facing = new THREE.Vector3();
  let view = 'window';
  let yaw = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    for (const tw of [...tweens]) {
      tw.age += dt;
      tw.step(Math.min(1, tw.age / tw.seconds));
      if (tw.age >= tw.seconds) { tweens.splice(tweens.indexOf(tw), 1); tw.resolve(); }
    }
    // Lifted things come up in front of the eyes, facing the inspector.
    // Turning eases the head round; the camera stays in the chair.
    yaw += (VIEWS[view] - yaw) * Math.min(dt * 5, 1);
    facing.copy(baseForward).applyAxisAngle(UP, yaw);
    engine.camera.lookAt(facing.add(engine.camera.position));
    engine.camera.getWorldDirection(forward);
    upward.copy(engine.camera.up).applyQuaternion(engine.camera.quaternion);
    readPos.copy(engine.camera.position).addScaledVector(forward, READ_DISTANCE).addScaledVector(upward, READ_RAISE);
    for (const item of liftables) {
      item.t += ((lifted === item.name ? 1 : 0) - item.t) * Math.min(dt * 7, 1);
      const k = ease(item.t);
      deskPos.copy(item.desk.position).y += hovered === item.name && k < 0.01 ? 0.02 : 0;
      item.holder.position.lerpVectors(deskPos, readPos, k);
      item.holder.quaternion.slerpQuaternions(item.desk.quaternion, engine.camera.quaternion, k);
      item.holder.scale.setScalar(item.desk.scale + (1 - item.desk.scale) * k);
    }
    notebook.cover.visible = notebook.t < 0.5;
    notebook.page.visible = notebook.t >= 0.5;
    transcript.feed(dt);
    transcript.slip.visible = transcript.t < 0.5;
    transcript.page.visible = transcript.t >= 0.5;
    for (const [verdict, s] of Object.entries(stamps)) {
      if (!stamping) s.holder.position.y = s.home.y + (hovered === `stamp-${verdict}` ? 0.03 : 0);
    }
    mic.holder.position.y = SILL + (hovered === 'mic' && !micHeld ? 0.02 : 0);
    bribe.holder.position.y = LEDGE.y + (hovered === 'bribe' ? 0.02 : 0);
    if (recording) {
      const pulse = reducedMotion ? 0 : Math.sin(t * 5);
      mic.ring.scale.setScalar(1.08 + pulse * 0.05);
      mic.ring.material.opacity = 0.65 + pulse * 0.15;
    }
    if (traveller) {
      traveller.update(t, dt);
      if (face.chinDown) traveller.head.rotation.x += 0.28;
      if (talking) traveller.jaw.rotation.x = 0.08 + Math.abs(Math.sin(t * 11)) * 0.3;
      if (thinking) {
        traveller.head.rotation.z += 0.16;
        traveller.head.rotation.x -= 0.1;
      }
      // He looks about while waiting, and turns to face you when he talks.
      if (!traveller.walking) {
        const target = talking || thinking ? 0 : Math.sin(t * 0.45) * 0.35;
        traveller.root.rotation.y += (target - traveller.root.rotation.y) * Math.min(dt * 4, 1);
      }
    }
    thoughtBubble.visible = Boolean(thinking && traveller && !traveller.walking);
    if (thoughtBubble.visible) {
      thoughtBubble.position.set(traveller.root.position.x + 0.65, 1.8 + (reducedMotion ? 0 : Math.sin(t * 3) * 0.025), TRAVELLER_AT.z + 0.22);
      thoughtBubble.quaternion.copy(engine.camera.quaternion);
    }
    if (leaving) leaving.update(t, dt);
    if (officer) officer.update(t, dt);
    arrivals.update(t, dt);
    engine.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Turned away: a police penguin runs in from the side, grabs him and hauls
  // him off, flapping, while the next traveller steps up.
  async function snatch(penguin) {
    leaving = penguin;
    const cop = makePolice();
    officer = cop;
    const grabX = penguin.root.position.x + 0.8;
    cop.root.position.set(WALK_OFF_X, TRAVELLER_AT.y, TRAVELLER_AT.z);
    cop.root.rotation.y = -Math.PI / 2;
    cop.walking = true;
    group.add(cop.root);
    penguin.setMood('annoyed');
    await tween(0.45, (p) => { cop.root.position.x = WALK_OFF_X + (grabX - WALK_OFF_X) * p; });
    // A beat facing the inspector, so POLICE on his cap reads.
    cop.walking = false;
    cop.root.rotation.y = 0;
    penguin.panicking = true;
    await tween(0.35, () => {});
    cop.walking = true;
    cop.root.rotation.y = Math.PI / 2;
    const from = penguin.root.position.x;
    await tween(0.75, (p) => {
      cop.root.position.x = grabX + (WALK_OFF_X + 0.6 - grabX) * p;
      penguin.root.position.x = from + (WALK_OFF_X - from) * p;
      penguin.root.position.y = TRAVELLER_AT.y + Math.sin(p * Math.PI) * 0.12;   // lifted off his feet
    });
    group.remove(penguin.root);
    group.remove(cop.root);
    if (leaving === penguin) leaving = null;
    if (officer === cop) officer = null;
  }

  async function walkOff(penguin, mood) {
    leaving = penguin;
    penguin.setMood(mood);
    await tween(0.35, () => {});
    penguin.walking = true;
    penguin.root.rotation.y = Math.PI / 2;
    const from = penguin.root.position.x;
    await tween(1.1, (p) => { penguin.root.position.x = from + (WALK_OFF_X - from) * p; });
    group.remove(penguin.root);
    if (leaving === penguin) leaving = null;
  }

  async function walkOn(penguin) {
    penguin.root.position.set(-WALK_OFF_X, TRAVELLER_AT.y, TRAVELLER_AT.z);
    penguin.root.rotation.y = Math.PI / 2;
    penguin.walking = true;
    group.add(penguin.root);
    await tween(1.1, (p) => { penguin.root.position.x = -WALK_OFF_X + (TRAVELLER_AT.x + WALK_OFF_X) * p; });
    penguin.walking = false;
  }

  const booth = {
    // Swapping travellers walks the old one off and the new one on.
    show(id, { reaction } = {}) {
      if (id === travellerId) return;
      const old = traveller;
      travellerId = id;
      traveller = id ? makeTraveller(id) : null;
      talking = false;
      thinking = false;
      face = FACES.neutral;
      if (old && reaction === 'away') snatch(old);
      else if (old) walkOff(old, reaction === 'through' ? 'happy' : 'neutral');
      if (!traveller) return;
      if (old) walkOn(traveller);
      else {
        traveller.root.position.copy(TRAVELLER_AT);
        group.add(traveller.root);
      }
    },
    setMood(mood) {
      face = FACES[mood] ?? FACES.neutral;
      if (!traveller) return;
      traveller.setMood(face.expression);
      traveller.panicking = Boolean(face.panicking);
      traveller.footTap = Boolean(face.footTap);
    },
    setTalking(on) { talking = on; },
    setThinking(on) { thinking = on; },
    setRecording(on) {
      recording = on;
      mic.light.color.set(on ? COLORS.live : COLORS.off);
      mic.ring.visible = on;
    },
    setPapers(paperFields, stamp = null) { papers.redraw(paperFields, stamp); },
    setNotes(name, notes) { notebook.redraw(name, notes); },
    // lines: [{ who, text }], oldest first; 'You' marks the inspector's own words.
    setTranscript(name, lines) { transcript.redraw(name, lines); },
    setComputer(lines) { computer.redraw(lines); },
    // 'croissant', 'cheese' or 'sticker' on the window ledge, or null for none.
    setBribe(item) { bribe.show(item); },
    toggle(name) { lifted = lifted === name ? null : name; },
    // Turns one view left (-1) or right (+1); papers in hand go back on the desk.
    look(step) {
      const next = VIEW_ORDER[VIEW_ORDER.indexOf(view) + step];
      if (!next) return;
      view = next;
      lifted = null;
      handlers.onView?.(view);
    },
    view: () => view,
    putDown() { lifted = null; },
    lifted: () => lifted,
    // The stamp comes down on the papers, leaves its mark, and goes home.
    async stamp(verdict, paperFields) {
      if (stamping) return;
      stamping = true;
      lifted = null;
      // Stamping happens at the window, so turn back to it first.
      if (view !== 'window') {
        view = 'window';
        handlers.onView?.(view);
        await tween(0.6, () => {});
      }
      const s = stamps[verdict];
      const over = papers.desk.position.clone().setY(SILL + 0.06);
      const lift = (a, b, p, h) => s.holder.position.lerpVectors(a, b, p).setY(s.holder.position.y + Math.sin(p * Math.PI) * h);
      await tween(0.35, (p) => lift(s.home, over, ease(p), 0.25));
      await tween(0.1, (p) => s.holder.position.setY(SILL + 0.06 - 0.05 * p));
      papers.redraw(paperFields, verdict);
      await tween(0.25, (p) => s.holder.position.setY(SILL + 0.01 + 0.05 * p));
      await tween(0.3, (p) => lift(over, s.home, ease(p), 0.15));
      s.holder.position.copy(s.home);
      stamping = false;
    },
  };
  return booth;
}
