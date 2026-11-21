// The view through the booth window (ADR-11): the border post into Antarctica.
// An ice shelf, the sea, a ship moored at the ice edge, icebergs, a welcome
// arrivals board, and penguins coming down the gangway. Scenery
// only: nothing here knows about the game. Every sign is made up.
import * as THREE from 'three';
import { part, box, mat, mapMat, textPlane } from '/penguins/engine.js';
import { makePenguin } from '/penguins/penguin.js';
import { DECK_Y, GANGWAY_X, WALK_Z, makeCrowd, pointAt } from '/arrivals.js';

const COLORS = {
  snow: '#e4e8ea', iceCliff: '#b9c6cc', drift: '#d6dde0', sea: '#35505f', berg: '#eef2f3',
  hull: '#b5533c', hullBand: '#ddd6c6', cabin: '#ddd6c6', window: '#38404d', funnel: '#d4aa45',
  gangway: '#8a9297', steel: '#5f6b73', board: '#1d2026',
};
const AMBER = '#f2b544';
const BOARD_FONT = 'Menlo, "Courier New", monospace';
export const INSPECTION_DOOR = { x: -1.28, z: -3.0 };

// The inspector's eye is only just above the window, so everything to be seen
// sits below eye height; the crowd walks well behind the traveller so it stays
// smaller than him and doesn't hide the ship.
const ICE_EDGE_Z = -4.4;
const HULL_FRONT_Z = -4.55;
const SIGNS_Z = -2.4;

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

// Weathered paint over narrow timber panels gives the back wall an actual
// surface, rather than the old blue sky reading as a blank wall.
function wallPaint() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d');
  g.fillStyle = '#78969a'; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = '#55777d'; g.fillRect(x, 0, 3, 512);
    g.fillStyle = '#a4b8b4'; g.fillRect(x + 5, 0, 2, 512);
  }
  for (let i = 0; i < 900; i += 1) {
    const x = (i * 127) % 512;
    const y = (i * 347) % 512;
    g.fillStyle = i % 3 ? '#c2d1c813' : '#324e561c';
    g.fillRect(x, y, 1 + (i % 5), 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return mapMat(texture);
}

// The arrivals door is cut into the left side of the painted back wall. The
// dark recess is behind the waiting line, so those penguins remain visible.
function buildInspectionWall(group) {
  const { x, z } = INSPECTION_DOOR;
  const wall = wallPaint();
  const frame = mat('#e8e2d4');
  const left = -3.6, right = 0.65, doorHalf = 0.5;
  const leftEdge = x - doorHalf, rightEdge = x + doorHalf;
  part(box(leftEdge - left, 2.6, 0.18), wall, group, [(left + leftEdge) / 2, 1.3, z - 0.09]);
  part(box(right - rightEdge, 2.6, 0.18), wall, group, [(rightEdge + right) / 2, 1.3, z - 0.09]);
  part(box(1.0, 0.63, 0.18), wall, group, [x, 2.285, z - 0.09]);
  part(box(right - left, 0.075, 0.25, 0.01), mat('#526b70'), group, [(left + right) / 2, 2.61, z - 0.02]);
  part(box(right - left, 0.13, 0.2), mat('#516c70'), group, [(left + right) / 2, 0.07, z + 0.015]);
  for (const side of [-1, 1]) {
    part(box(0.07, 1.96, 0.2), frame, group, [x + side * doorHalf, 0.98, z + 0.015]);
  }
  part(box(1.07, 0.075, 0.2), frame, group, [x, 1.98, z + 0.015]);
  part(box(0.98, 2.0, 0.02), mat('#283b43'), group, [x, 1.0, z - 1.32], undefined, undefined, false);
  part(box(1.05, 0.035, 0.4), mat('#5f6b73'), group, [x, 0.02, z + 0.1], undefined, undefined, false);
  const leaf = new THREE.Group();
  leaf.position.set(leftEdge + 0.05, 0, z + 0.04);
  leaf.rotation.y = 1.3;
  group.add(leaf);
  part(box(0.9, 1.88, 0.045, 0.012), mat('#445f65'), leaf, [0.45, 0.95, 0]);
  part(new THREE.SphereGeometry(0.023, 10, 8), mat('#c4a46b'), leaf, [0.8, 0.86, 0.045], undefined, undefined, false);
  const label = textPlane(0.78, 0.18, (g, w, h) => {
    g.fillStyle = '#2f4858'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.font = `bold ${h * 0.47}px ${BOARD_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ARRIVALS', w / 2, h * 0.54);
  }, 1024);
  label.redraw();
  label.mesh.position.set(x + 0.75, 2.28, z + 0.02);
  group.add(label.mesh);
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
// other booths. When each sets off and where he is: arrivals.js.
function makeArrivals(group) {
  const crowd = makeCrowd();
  const penguins = crowd.walkers.map(() => {
    const penguin = makePenguin();
    penguin.showHearts = false;
    penguin.root.visible = false;
    group.add(penguin.root);
    return penguin;
  });
  return {
    update(t, dt) {
      crowd.step(dt);
      crowd.walkers.forEach((w, i) => {
        const penguin = penguins[i];
        if (w.justArrived) dressForTheIce(penguin);
        penguin.root.visible = w.visible;
        penguin.walking = w.visible;
        if (!w.visible) return;
        const at = pointAt(w.distance);
        penguin.root.position.set(at.x, at.y, at.z);
        penguin.root.rotation.y = at.facing;
        penguin.update(t, dt);
      });
    },
  };
}

export function buildScenery(group) {
  buildIce(group);
  buildShip(group);
  buildBoard(group);
  buildInspectionWall(group);
  return makeArrivals(group);
}
