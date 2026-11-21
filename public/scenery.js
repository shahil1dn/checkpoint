// The view through the booth window (ADR-11): the border post into Antarctica.
// An ice shelf, the sea, a ship moored at the ice edge, icebergs, a welcome
// sign and an arrivals board, and penguins coming down the gangway. Scenery
// only: nothing here knows about the game. Every sign is made up.
import * as THREE from 'three';
import { part, box, mat, textPlane } from '/penguins/engine.js';
import { makePenguin } from '/penguins/penguin.js';

const COLORS = {
  snow: '#e4e8ea', iceCliff: '#b9c6cc', drift: '#d6dde0', sea: '#35505f', berg: '#eef2f3',
  hull: '#b5533c', hullBand: '#ddd6c6', cabin: '#ddd6c6', window: '#38404d', funnel: '#d4aa45',
  gangway: '#8a9297', steel: '#5f6b73', board: '#1d2026', sign: '#2f4858',
};
const AMBER = '#f2b544';
const BOARD_FONT = 'Menlo, "Courier New", monospace';

// The inspector's eye is only just above the window, so everything to be seen
// sits below eye height; the crowd walks well behind the traveller so it stays
// smaller than him and doesn't hide the ship.
const ICE_EDGE_Z = -4.4;
const HULL_FRONT_Z = -4.55;
const DECK_Y = 0.6;
const GANGWAY_X = -2.2;
const WALK_Z = -3.95;
const SIGNS_Z = -2.4;
const EXIT_X = 4.2;

// Flat things on a surface (art direction, section 1): no ink hull, no shadow.
function flat(geo, colour, parent, pos, rot) {
  const m = part(geo, mat(colour), parent, pos, rot, undefined, false);
  m.castShadow = m.receiveShadow = false;
  return m;
}

function buildIce(group) {
  const depth = -ICE_EDGE_Z;
  part(box(9, 0.3, depth, 0.03), mat(COLORS.snow), group, [0, -0.15, -depth / 2]);
  part(box(8.9, 0.6, depth - 0.05, 0.05), mat(COLORS.iceCliff), group, [0, -0.6, -depth / 2]);
  for (const [x, z, r] of [[-3.1, -2.0, 0.5], [2.9, -3.3, 0.6], [-0.9, -3.6, 0.35]]) {
    part(new THREE.SphereGeometry(r, 16, 10), mat(COLORS.drift), group, [x, 0, z], [0, 0, 0], [1, 0.18, 0.7]);
  }
  flat(box(30, 0.02, 12), COLORS.sea, group, [0, -0.45, ICE_EDGE_Z - 6]);
  // Icebergs far out: low poly is fine for props this far away.
  for (const [x, z, s] of [[-4.5, -11, 1.4], [3.8, -12, 1.8], [0.6, -13, 1.0]]) {
    part(new THREE.ConeGeometry(s, s * 1.1, 6), mat(COLORS.berg), group, [x, -0.45 + s * 0.5, z], [0, x, 0]);
  }
}

function buildShip(group) {
  const depth = 1.4;
  const z = HULL_FRONT_Z - depth / 2;
  const face = HULL_FRONT_Z + 0.01;
  part(box(12, 1.2, depth, 0.1), mat(COLORS.hull), group, [0.5, DECK_Y - 0.6, z]);
  flat(box(12, 0.12, 0.02), COLORS.hullBand, group, [0.5, DECK_Y - 0.12, face]);
  for (let x = -4.5; x <= 5.5; x += 0.8) {
    if (Math.abs(x - GANGWAY_X) < 0.5) continue;
    flat(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), COLORS.window, group, [x, DECK_Y - 0.38, face], [Math.PI / 2, 0, 0]);
  }
  // The cabin and funnel sit right of centre, clear of the gangway.
  part(box(3.2, 0.9, 1.0, 0.06), mat(COLORS.cabin), group, [1.8, DECK_Y + 0.45, z - 0.1]);
  for (let x = 0.6; x <= 3.0; x += 0.6) flat(box(0.36, 0.26, 0.02), COLORS.window, group, [x, DECK_Y + 0.55, z + 0.41]);
  part(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 14), mat(COLORS.funnel), group, [2.6, DECK_Y + 1.25, z - 0.1]);
  // The gangway runs from the deck down onto the ice.
  const run = new THREE.Vector3(0, -DECK_Y, WALK_Z + 0.1 - HULL_FRONT_Z);
  const gangway = part(box(0.6, 0.04, run.length(), 0.01), mat(COLORS.gangway), group,
    [GANGWAY_X, DECK_Y / 2, (HULL_FRONT_Z + WALK_Z + 0.1) / 2], [Math.atan2(DECK_Y, run.z), 0, 0]);
  gangway.receiveShadow = false;
}

function buildSign(group) {
  const at = new THREE.Vector3(-1.55, 1.5, SIGNS_Z);
  const sign = textPlane(1.1, 0.24, (g, w, h) => {
    g.fillStyle = COLORS.sign; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.font = `600 ${h * 0.44}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('WELCOME TO ANTARCTICA', w / 2, h * 0.53, w * 0.9);
  }, 1024);
  sign.redraw();
  part(box(1.16, 0.3, 0.05, 0.015), mat(COLORS.steel), group, [at.x, at.y, at.z]);
  sign.mesh.position.set(at.x, at.y, at.z + 0.03);
  group.add(sign.mesh);
  for (const dx of [-0.45, 0.45]) part(new THREE.CylinderGeometry(0.012, 0.012, 2, 8), mat(COLORS.steel), group, [at.x + dx, at.y + 1.15, at.z]);
}

function drawBoard(g, w, h) {
  g.fillStyle = COLORS.board; g.fillRect(0, 0, w, h);
  const rows = [
    ['ARRIVALS', '', 'JETTY 2'],
    ['09:16', 'USHUAIA', 'DOCKED'],
    ['10:16', 'CAPE TOWN', 'DOCKED'],
    ['11:16', 'HOBART', 'ON THE ICE'],
    ['12:16', 'PARIS?', 'CHEESE DELAY'],
  ];
  const line = h / (rows.length + 0.6);
  g.font = `bold ${line * 0.6}px ${BOARD_FONT}`;
  g.textBaseline = 'middle';
  rows.forEach(([time, from, status], i) => {
    const y = line * (i + 0.8);
    g.fillStyle = i === 0 ? '#f4efe2' : AMBER;
    g.textAlign = 'left';
    g.fillText(time, w * 0.05, y);
    g.fillText(from, w * 0.27, y);
    g.textAlign = 'right';
    g.fillText(status, w * 0.95, y);
  });
}

// A free-standing arrivals screen on a post, at a penguin's eye height.
function buildBoard(group) {
  const at = new THREE.Vector3(1.55, 1.34, SIGNS_Z);
  part(box(1.18, 0.6, 0.08, 0.02), mat(COLORS.steel), group, [at.x, at.y, at.z]);
  const face = textPlane(1.08, 0.5, drawBoard, 1024);
  face.redraw();
  face.mesh.position.set(at.x, at.y, at.z + 0.045);
  group.add(face.mesh);
  part(new THREE.CylinderGeometry(0.04, 0.05, at.y - 0.3, 10), mat(COLORS.steel), group, [at.x, (at.y - 0.3) / 2, at.z]);
  part(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), mat(COLORS.steel), group, [at.x, 0.02, at.z]);
}

// Crowd penguins are re-dressed every time they come ashore (art direction,
// section 3), dressed for the cold: mostly hats, the odd coffee or umbrella.
const HAT_COLOURS = ['#b5533c', '#3f6e8c', '#d4aa45', '#5f6b73', '#3f8f5a'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
function dressForTheIce(penguin) {
  const salaryman = Math.random() < 0.2;
  penguin.setLook({
    hat: Math.random() < 0.7 ? pick(['beanie', 'beanie', 'cap', 'bowler']) : null,
    hatColor: pick(HAT_COLOURS),
    hair: pick(['spikes', 'curl', 'swoop']),
    glasses: Math.random() < 0.3 ? 'round' : null,
    tie: salaryman ? '#c46a5b' : null,
    item: salaryman ? 'newspaper' : pick([null, null, 'coffee', 'umbrella']),
    height: 0.85 + Math.random() * 0.15,
  });
}

// Penguins come down the gangway onto the ice, then waddle off towards the
// other booths. A small pool is reused, so it never grows.
function makeArrivals(group, count = 3) {
  const walkers = Array.from({ length: count }, (_, i) => {
    const penguin = makePenguin();
    penguin.showHearts = false;
    penguin.root.visible = false;
    group.add(penguin.root);
    return { penguin, wait: 1 + i * 3.2, stage: 'waiting' };
  });
  const SPEED = 0.8;
  const top = HULL_FRONT_Z - 0.2;
  return {
    update(t, dt) {
      for (const w of walkers) {
        const { penguin } = w;
        const at = penguin.root.position;
        if (w.stage === 'waiting') {
          w.wait -= dt;
          if (w.wait > 0) continue;
          dressForTheIce(penguin);
          at.set(GANGWAY_X, DECK_Y, top);
          penguin.root.rotation.y = 0;
          penguin.walking = true;
          penguin.root.visible = true;
          w.stage = 'coming ashore';
        } else if (w.stage === 'coming ashore') {
          at.z += SPEED * dt;
          at.y = DECK_Y * Math.max(0, (WALK_Z - at.z) / (WALK_Z - top));
          if (at.z >= WALK_Z) { at.set(at.x, 0, WALK_Z); penguin.root.rotation.y = Math.PI / 2; w.stage = 'walking on'; }
        } else if (w.stage === 'walking on') {
          at.x += SPEED * dt;
          if (at.x >= EXIT_X) {
            penguin.root.visible = false;
            penguin.walking = false;
            w.wait = 2 + Math.random() * 4;
            w.stage = 'waiting';
          }
        }
        penguin.update(t, dt);
      }
    },
  };
}

export function buildScenery(group) {
  buildIce(group);
  buildShip(group);
  buildSign(group);
  buildBoard(group);
  return makeArrivals(group);
}
