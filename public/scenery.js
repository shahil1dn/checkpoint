// The view through the booth window: a polar train pulls up to the border
// platform. The train and its sliding doors are scenery; booth.js handles the
// actual travellers and the order they step out.
import * as THREE from 'three';
import { part, box, mat, textPlane } from '/penguins/engine.js';

const COLORS = {
  snow: '#e4e8ea', iceCliff: '#b9c6cc', drift: '#d6dde0', sea: '#35505f', berg: '#eef2f3',
  steel: '#5f6b73', board: '#1d2026', sign: '#2f4858',
};
const AMBER = '#f2b544';
const BOARD_FONT = 'Menlo, "Courier New", monospace';
export const TRAIN_DOOR = { x: -0.35, z: -3.1 };

const ICE_EDGE_Z = -4.4;
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

function buildTrain(group) {
  const train = new THREE.Group();
  train.position.x = 6.2;
  group.add(train);
  const front = TRAIN_DOOR.z - 0.05;
  const body = mat('#607b8c');
  const trim = mat('#d9ddd6');
  const window = mat('#253946');
  const stripe = mat('#b5533c');

  // Two rails and a platform edge make the horizontal arrival legible.
  for (const z of [front - 0.25, front - 0.95]) {
    part(box(13, 0.035, 0.055), mat('#59616a'), group, [0, 0.015, z], undefined, undefined, false);
  }
  for (let x = -6; x <= 6; x += 0.45) {
    part(box(0.11, 0.025, 1.05), mat('#69737a'), group, [x, 0, front - 0.6], undefined, undefined, false);
  }
  part(box(6.4, 0.045, 0.16), mat('#c6c9be'), group, [0, 0.025, front + 0.34], undefined, undefined, false);

  // The car has a real opening in the front wall; the two leaves slide into
  // the adjoining panels, exposing the passengers waiting inside.
  part(box(5.5, 0.5, 1.15, 0.08), mat('#3e5669'), train, [0, 0.25, front - 0.55]);
  part(box(5.5, 0.26, 1.15, 0.08), body, train, [0, 2.1, front - 0.55]);
  part(box(5.6, 0.15, 1.2, 0.07), trim, train, [0, 2.29, front - 0.55]);
  part(box(5.35, 1.65, 0.07), body, train, [0, 1.32, front - 1.1]);
  for (const x of [-2.72, 2.72]) part(box(0.08, 1.9, 1.15), body, train, [x, 1.23, front - 0.55]);
  const doorLeft = TRAIN_DOOR.x - 0.55;
  const doorRight = TRAIN_DOOR.x + 0.55;
  const leftEnd = -2.68, rightEnd = 2.68;
  part(box(doorLeft - leftEnd, 1.6, 0.09), body, train, [(leftEnd + doorLeft) / 2, 1.3, front]);
  part(box(rightEnd - doorRight, 1.6, 0.09), body, train, [(doorRight + rightEnd) / 2, 1.3, front]);
  for (const x of [doorLeft, doorRight]) part(box(0.065, 1.62, 0.11), trim, train, [x, 1.3, front + 0.06]);
  part(box(1.18, 0.065, 0.11), trim, train, [TRAIN_DOOR.x, 2.11, front + 0.06]);
  for (const x of [-1.95, 0.95, 1.9]) {
    part(box(0.82, 0.72, 0.025, 0.04), trim, train, [x, 1.47, front + 0.06], undefined, undefined, false);
    part(box(0.74, 0.64, 0.027, 0.035), window, train, [x, 1.47, front + 0.08], undefined, undefined, false);
    part(box(0.71, 0.035, 0.02), mat('#78939d'), train, [x, 1.69, front + 0.1], undefined, undefined, false);
  }
  part(box(5.35, 0.12, 0.025), stripe, train, [0, 0.6, front + 0.06], undefined, undefined, false);
  part(box(1.08, 1.55, 0.02), window, train, [TRAIN_DOOR.x, 1.28, front - 1.06], undefined, undefined, false);

  const leaves = [-1, 1].map((side) => {
    const leaf = new THREE.Group();
    leaf.position.set(TRAIN_DOOR.x + side * 0.275, 0, front + 0.09);
    train.add(leaf);
    part(box(0.52, 1.55, 0.045, 0.012), trim, leaf, [0, 1.29, 0]);
    part(box(0.39, 0.5, 0.05, 0.02), window, leaf, [0, 1.54, 0.03], undefined, undefined, false);
    part(box(0.025, 0.22, 0.016), mat('#879599'), leaf, [-side * 0.16, 1.03, 0.04], undefined, undefined, false);
    return leaf;
  });
  const name = textPlane(1.14, 0.17, (g, w, h) => {
    g.fillStyle = '#2f4858'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2'; g.font = `bold ${h * 0.46}px ${BOARD_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('POLAR LINE', w / 2, h * 0.55);
  }, 1024);
  name.redraw();
  name.mesh.position.set(0.85, 2.11, front + 0.065);
  train.add(name.mesh);

  return {
    group: train,
    openDoors(amount) {
      leaves[0].position.x = TRAIN_DOOR.x - 0.275 - 0.55 * amount;
      leaves[1].position.x = TRAIN_DOOR.x + 0.275 + 0.55 * amount;
    },
  };
}

function drawBoard(g, w, h) {
  g.fillStyle = COLORS.board; g.fillRect(0, 0, w, h);
  const rows = [
    ['ARRIVALS', '', 'PLATFORM 2'],
    ['09:16', 'USHUAIA', 'ARRIVED'],
    ['10:16', 'CAPE TOWN', 'ARRIVED'],
    ['11:16', 'HOBART', 'PULLING IN'],
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

export function buildScenery(group) {
  buildIce(group);
  buildSign(group);
  buildBoard(group);
  return buildTrain(group);
}
