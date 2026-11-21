// The penguin cast. Build, face and expressions follow docs/ART-DIRECTION.md section 3.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, INK, mat, mapMat, role, part, box, ball, twoTone, NO_SHADE } from './engine.js';
import { bubbleTexture } from './bubbles.js';

const HR = 0.5, HEAD_SCALE = [1, 0.93, 0.96];
const BUBBLE_Y = 1.9;   // where a speech bubble's tail tip hangs: straight above the head
const BODY_PROFILE = [[0, 0], [0.4, 0.02], [0.55, 0.16], [0.6, 0.36], [0.56, 0.58], [0.46, 0.78], [0.3, 0.92], [0, 0.98]]
  .map(([r, y]) => new THREE.Vector2(r, y));
const lerp = THREE.MathUtils.lerp;

// Face: eyes, lids, happy eyes, brows and blush are drawn in the head's shader, in (azimuth,
// elevation) space around each eye, so they stay flat and crisp like a drawn cartoon face.
const FACE_CODE = `
    vec3 fn = normalize(vObjPos);
    vec2 q = vec2(atan(fn.x, fn.z), asin(clamp(fn.y, -1.0, 1.0)));
    float front = step(0.0, fn.z);
    vec3 col = diffuseColor.rgb;
    for (int i = 0; i < 2; i++) {
      float side = i == 0 ? -1.0 : 1.0;
      vec2 d = q - vec2(side * 0.3, 0.1);
      float inward = -side * d.x;                       // + towards the middle of the face
      // blush
      float ch = length((q - vec2(side * 0.5, -0.13)) / vec2(0.075, 0.045)) - 1.0;
      col = mix(col, uBlush, uHappy * front * (1.0 - smoothstep(-0.25, 0.25, ch)));
      // open eye: an upright almond pupil with a catch-light
      float openEye = (1.0 - uHappy) * front;
      float pupil = length(d / vec2(0.068, 0.1 * uBlink)) - 1.0;
      float lidY = mix(0.3, 0.015 - 0.4 * inward, 1.0 - uMood);   // grumpy lid slants down to the inner corner
      float aboveLid = smoothstep(-0.003, 0.003, d.y - lidY);
      float ap = fwidth(pupil);
      col = mix(col, uInk, (1.0 - smoothstep(-ap, ap, pupil)) * (1.0 - aboveLid) * openEye);
      float hl = length(d - vec2(-0.018, 0.03)) - 0.017;
      float ah = fwidth(hl);
      col = mix(col, vec3(1.0), (1.0 - smoothstep(-ah, ah, hl)) * (1.0 - aboveLid) * openEye * step(0.5, uBlink));
      float lidLine = (1.0 - smoothstep(0.006, 0.011, abs(d.y - lidY))) * (1.0 - smoothstep(0.06, 0.075, abs(d.x)));
      col = mix(col, uInk, lidLine * step(0.05, 1.0 - uMood) * openEye);
      // happy eye: a closed upward arc
      float arc = abs(length(d - vec2(0.0, -0.035)) - 0.062) - 0.014;
      float aa = fwidth(arc);
      col = mix(col, uInk, (1.0 - smoothstep(-aa, aa, arc)) * smoothstep(-0.04, -0.025, d.y) * uHappy * front);
      // brow: a rounded stroke, tilted by mood
      vec2 b = q - vec2(side * 0.31, 0.255 + uBrowLift);
      float ang = side * uBrowAngle;
      b = vec2(cos(ang) * b.x + sin(ang) * b.y, -sin(ang) * b.x + cos(ang) * b.y);
      float brow = length(vec2(max(abs(b.x) - 0.06, 0.0), b.y)) - 0.018;
      float ab = fwidth(brow);
      col = mix(col, uInk, (1.0 - smoothstep(-ab, ab, brow)) * front);
    }
    diffuseColor.rgb = col;`;
const MASK_FIELD = `float regionField(vec3 p){
    vec3 n = normalize(p); float a = atan(n.x, n.z), e = asin(clamp(n.y, -1.0, 1.0));
    float lobeL = (pow(a + 0.3, 2.0) + pow(e - 0.1, 2.0)) / 0.1089 - 1.0;
    float lobeR = (pow(a - 0.3, 2.0) + pow(e - 0.1, 2.0)) / 0.1089 - 1.0;
    float muzzle = pow(a / 0.58, 2.0) + pow((e + 0.22) / 0.36, 2.0) - 1.0;
    return min(min(lobeL, lobeR), muzzle);
  }`;

// Shared geometry: built once, used by every penguin.
let shared = null;
function sharedGeometry() {
  if (shared) return shared;
  const beakProfile = [[0, 0], [0.1, 0], [0.102, 0.03], [0.088, 0.09], [0.06, 0.15], [0.026, 0.192], [0, 0.205]];
  const beak = (k, len) => new THREE.LatheGeometry(beakProfile.map(([r, y]) => new THREE.Vector2(r * k, y * len)), 24);
  const foot = new THREE.Shape();
  foot.moveTo(-0.06, 0);
  foot.quadraticCurveTo(-0.11, 0.08, -0.13, 0.17);   // outer edge
  foot.quadraticCurveTo(-0.125, 0.235, -0.07, 0.195); // left toe
  foot.quadraticCurveTo(-0.05, 0.18, -0.035, 0.2);    // web
  foot.quadraticCurveTo(0, 0.27, 0.035, 0.2);         // middle toe
  foot.quadraticCurveTo(0.05, 0.18, 0.07, 0.195);     // web
  foot.quadraticCurveTo(0.125, 0.235, 0.13, 0.17);    // right toe
  foot.quadraticCurveTo(0.11, 0.08, 0.06, 0);         // outer edge
  foot.quadraticCurveTo(0, -0.07, -0.06, 0);          // heel
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.1); heart.bezierCurveTo(-0.28, 0.12, -0.12, 0.3, 0, 0.14); heart.bezierCurveTo(0.12, 0.3, 0.28, 0.12, 0, -0.1);
  const heartGeo = new THREE.ExtrudeGeometry(heart, { depth: 0.06, bevelEnabled: false, curveSegments: 5 });
  heartGeo.center();
  const tie = new THREE.Shape();
  tie.moveTo(-0.035, 0); tie.lineTo(0.035, 0); tie.lineTo(0.065, -0.3); tie.lineTo(0, -0.37); tie.lineTo(-0.065, -0.3); tie.closePath();
  shared = {
    upperBeak: beak(1, 1), lowerBeak: beak(0.78, 0.72),
    foot: new THREE.ExtrudeGeometry(foot, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 5, curveSegments: 14 }),
    flipper: new THREE.LatheGeometry([[0, 0], [0.09, -0.06], [0.15, -0.22], [0.14, -0.42], [0.08, -0.56], [0, -0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 16),
    heart: heartGeo,
    tie: new THREE.ExtrudeGeometry(tie, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }),
    zTexture: zTexture(),
    grawlix: [0, 1, 2].map(grawlixTexture),
    spark: sparkTexture(),
    capPeak: capPeak(),
    toqueBand: toqueBand(),
    serverCap: serverCap(),
    capBack: capBackTexture(),
    newsprint: newsprintTexture(),
    mask: maskTexture(),
    net: netTexture(),
    star: starTexture(),
  };
  return shared;
}
// A baseball cap's peak: a D-shape round the front of the crown, longest at the middle and
// nothing at the sides, bent so its sides droop the way a worn-in cap's do.
function capPeak() {
  const shape = new THREE.Shape(), n = 20, inner = 0.46, reach = 0.3, spread = 1.15;
  const angle = (i) => -spread + (2 * spread * i) / n;
  for (let i = 0; i <= n; i++) {
    const a = angle(i), r = inner + reach * Math.pow(Math.cos((a / spread) * (Math.PI / 2)), 0.7);
    if (i === 0) shape.moveTo(Math.sin(a) * r, Math.cos(a) * r); else shape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  for (let i = n; i >= 0; i--) shape.lineTo(Math.sin(angle(i)) * inner, Math.cos(angle(i)) * inner);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(Math.PI / 2);   // lay it flat: the shape's forward becomes +z, its thickness goes down
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - 0.38 * pos.getX(i) ** 2);
  geo.computeVertexNormals();
  return geo;
}
// A chef's toque band: a slightly flared tube with fine vertical pleats pressed into it.
function toqueBand() {
  const geo = new THREE.CylinderGeometry(0.31, 0.325, 0.28, 64, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
    if (r < 1e-4) continue;   // the cap centres
    const pleat = 1 + 0.035 * (0.5 + 0.5 * Math.cos(16 * Math.atan2(z, x)));
    pos.setX(i, x * pleat); pos.setZ(i, z * pleat);
  }
  geo.computeVertexNormals();
  return geo;
}
// The height of the top of the head at (x, z), in the head group's space (just under its surface).
const headTopAt = (x, z) => HR * HEAD_SCALE[1] * Math.sqrt(Math.max(0, 1 - (x / HR) ** 2 - (z / (HR * HEAD_SCALE[2])) ** 2)) - 0.02;
// A server's paper cap, the boat-shaped kind chippy and diner staff wear: a wedge running front to
// back, full width at its foot and folding up to a ridge, its foot following the curve of the head.
const SERVER_CAP = { half: 0.3, length: 0.36, rise: 0.22, lift: 0.12 };
function serverCap() {
  const { half, length, rise, lift } = SERVER_CAP, N = 24, M = 8;
  // the foot hugs the crown, but its ends lift off the head rather than running down the face
  const bottom = (z) => Math.max(headTopAt(half, z), headTopAt(half, 0) - lift);
  const ridge = (z) => Math.max(headTopAt(half, 0) + rise * (1 - Math.pow(Math.abs(z) / length, 4)), bottom(z) + 0.01);
  // Built as a grid (along the cap x up each side) rather than extruded, so the sides really do bow
  // outwards between foot and crest; a flat slab there dips under the head's curve and the head shows.
  const verts = [], index = [];
  const at = (s, i, j) => (s < 0 ? 0 : (N + 1) * (M + 1)) + i * (M + 1) + j;
  for (const s of [-1, 1]) for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
    const z = -length + (2 * length * i) / N, t = j / M, b = bottom(z);
    verts.push(s * half * (1 - 0.8 * Math.pow(t, 1.6)), b + t * (ridge(z) - b), z);
  }
  const quad = (a, b, c, d) => index.push(a, b, c, a, c, d);
  for (const s of [-1, 1]) for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) quad(at(s, i, j), at(s, i + 1, j), at(s, i + 1, j + 1), at(s, i, j + 1));
  for (let i = 0; i < N; i++) quad(at(-1, i, M), at(-1, i + 1, M), at(1, i + 1, M), at(1, i, M));   // the crest
  for (const i of [0, N]) for (let j = 0; j < M; j++) quad(at(-1, i, j), at(-1, i, j + 1), at(1, i, j + 1), at(1, i, j));   // the ends
  // wind every triangle outwards: away from a line running along the inside of the cap
  const v = (k) => new THREE.Vector3(verts[3 * k], verts[3 * k + 1], verts[3 * k + 2]);
  const inside = headTopAt(half, 0) + rise * 0.3;
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [v(index[k]), v(index[k + 1]), v(index[k + 2])];
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const centre = a.clone().add(b).add(c).divideScalar(3);
    if (normal.dot(centre.clone().sub(new THREE.Vector3(0, inside, centre.z * 0.5))) < 0) [index[k + 1], index[k + 2]] = [index[k + 2], index[k + 1]];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(index);
  return toCreasedNormals(geo, 0.6);
}
// The back of a baseball cap: the arched opening (the head shows through, so it's penguin-dark)
// with the adjustable strap across its foot.
function capBackTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.lineWidth = 6; g.strokeStyle = INK;
  g.beginPath(); g.moveTo(58, 160); g.lineTo(58, 92); g.arc(128, 92, 70, Math.PI, 0); g.lineTo(198, 160); g.closePath();
  g.fillStyle = PALETTE.penguin; g.fill(); g.stroke();
  g.fillStyle = '#3a3f4a'; g.fillRect(40, 118, 176, 30); g.strokeRect(40, 118, 176, 30);
  g.fillStyle = '#b4bec3'; g.fillRect(112, 114, 32, 38); g.strokeRect(112, 114, 32, 38);   // the buckle
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// The tech bro's cap badge: a terracotta spark, rays of uneven length round a small centre.
function sparkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64); g.strokeStyle = g.fillStyle = '#d97757'; g.lineCap = 'round'; g.lineWidth = 11;
  const lengths = [50, 40, 46, 36, 52, 42, 38, 48, 40, 44, 36];
  lengths.forEach((len, i) => {
    const a = (i / lengths.length) * Math.PI * 2 + 0.3;
    g.beginPath(); g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  });
  g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// The salaryman's paper: pink broadsheet, a headline bar and columns of grey print.
function newsprintTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f2b8a0'; g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#3a3a40'; g.fillRect(8, 8, 112, 12);
  g.fillStyle = '#8a7f7a';
  for (let col = 0; col < 3; col++) for (let row = 0; row < 8; row++) g.fillRect(8 + col * 39, 28 + row * 8, row % 4 === 3 ? 20 : 34, 3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// A comic swearing bubble: scribbled symbols ("#@$%!") in a jagged speech bubble. Three variants
// are cycled so the scribble looks like it's being shouted, not printed.
function grawlixTexture(variant) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 120;
  const g = c.getContext('2d');
  let seed = variant * 97 + 13;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.lineJoin = g.lineCap = 'round';
  // spiky bubble with a tail pointing down-left
  g.beginPath();
  const cx = 84, cy = 50, spikes = 14;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2, rad = i % 2 ? 44 + r() * 6 : 34;
    const x = cx + Math.cos(a) * rad * 1.45, y = cy + Math.sin(a) * rad * 0.95;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#ffffff'; g.fill();
  g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(52, 80); g.lineTo(26, 112); g.lineTo(66, 86); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.stroke();
  // scribbled symbols, each tilted and jittered
  const symbols = ['#', '@', '$', '%', '!', '&', '*'];
  g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(40 + i * 21 + (r() - 0.5) * 6, 50 + (r() - 0.5) * 16);
    g.rotate((r() - 0.5) * 0.9);
    g.fillStyle = i % 2 ? '#d8433a' : INK;
    g.fillText(symbols[Math.floor(r() * symbols.length)], 0, 0);
    g.restore();
  }
  // a frantic scribble underneath
  g.beginPath(); g.moveTo(44, 74);
  for (let i = 0; i < 9; i++) g.lineTo(48 + i * 9, 70 + (i % 2 ? -8 : 6) + (r() - 0.5) * 4);
  g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// A burglar's mask: a black band round the head with two eye holes, painted on a strip of sphere
// that wraps the head at eye level (u runs round the head, v from the top of the strip down).
const MASK_BAND = { thetaStart: 1.31, thetaLength: 0.34 };
function maskTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1f2126'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-out';
  const v = ((Math.PI / 2 - 0.1) - MASK_BAND.thetaStart) / MASK_BAND.thetaLength;   // the eyes sit 0.1 above the equator
  for (const a of [-0.3, 0.3]) {   // eye azimuths, as in the face shader; the front of the head is u = 0.25
    g.beginPath(); g.ellipse(((Math.PI / 2 + a) / (Math.PI * 2)) * c.width, v * c.height, 20, 20, 0, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
// A hairnet's mesh: a fine diamond lattice over white, so the cap reads as net rather than cloth.
function netTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f4f4'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#c9d0d3'; g.lineWidth = 2;
  for (let k = -64; k <= 64; k += 16) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke();
    g.beginPath(); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 2);
  return tex;
}
function starTexture() {   // a dizzy star, for someone knocked out
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 12 : 28;
    g.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
  }
  g.closePath(); g.fillStyle = '#f2c94c'; g.fill(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function zTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = INK; g.strokeText('z', 32, 34);
  g.fillStyle = '#ffffff'; g.fillText('z', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the knitted scarf (the main penguin's signature) ----------
function lerpN(a, b, k) { return a + (b - a) * k; }
const bodyRadiusAt = (y) => {
  for (let i = 1; i < BODY_PROFILE.length; i++) {
    const a = BODY_PROFILE[i - 1], b = BODY_PROFILE[i];
    if (y <= b.y) return lerpN(a.x, b.x, (y - a.y) / (b.y - a.y));
  }
  return 0;
};
const onBelly = (x, y, lift) => new THREE.Vector3(x, y, Math.sqrt(Math.max(bodyRadiusAt(y) ** 2 - x * x, 0)) * 0.9 + lift);
function knitRing() {
  const g = new THREE.TorusGeometry(0.4, 0.06, 12, 48);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {   // uneven hand-knit wobble in the ring's radius
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.y, v.x), wobble = 1 + Math.sin(ang * 3 + 0.7) * 0.025 + Math.sin(ang * 7) * 0.012;
    pos.setXY(i, v.x * wobble, v.y * wobble);
  }
  g.computeVertexNormals();
  return g;
}
// A cloth strip with a rectangular cross-section swept along a curve, flat against the body.
function strip(path, widthTop, widthBottom, thickness, n) {
  const curve = new THREE.CatmullRomCurve3(path);
  const centres = curve.getSpacedPoints(n), tangent = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3();
  const verts = [];
  centres.forEach((c, i) => {
    curve.getTangentAt(i / n, tangent);
    out.set(c.x, 0, c.z).normalize();
    side.crossVectors(tangent, out).normalize();
    out.crossVectors(side, tangent).normalize();
    const w = lerpN(widthTop, widthBottom, Math.sqrt(i / n)) / 2, h = thickness / 2;
    for (const [sw, sh] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      verts.push(new THREE.Vector3().copy(c).addScaledVector(side, sw * w).addScaledVector(out, sh * h));
  });
  const index = [];
  const face = (a, b, c, want) => {   // wind each triangle so it faces `want`, whatever the curve does
    const normal = new THREE.Vector3().subVectors(verts[b], verts[a]).cross(new THREE.Vector3().subVectors(verts[c], verts[a]));
    index.push(...(normal.dot(want) < 0 ? [a, c, b] : [a, b, c]));
  };
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c = a + 4, d = b + 4;
    const want = new THREE.Vector3().addVectors(verts[a], verts[d]).multiplyScalar(0.5).sub(centres[i].clone().lerp(centres[i + 1], 0.5));
    face(a, c, b, want); face(b, c, d, want);
  }
  const startDir = curve.getTangentAt(0).negate(), endDir = curve.getTangentAt(1), e = n * 4;
  face(0, 1, 2, startDir); face(0, 2, 3, startDir); face(e, e + 1, e + 2, endDir); face(e, e + 2, e + 3, endDir);
  const g = new THREE.BufferGeometry().setFromPoints(verts);
  g.setIndex(index);
  g.computeVertexNormals();
  return { geo: g, end: centres[n], dir: endDir, side: side.clone(), width: widthBottom };
}
function addScarf(pBody) {
  // Stripes are inked at every colour change; knit ribs are a light darkening across the weave.
  part(...twoTone(knitRing(), PALETTE.scarf, PALETTE.scarf2,
    'float regionField(vec3 p){ return sin(atan(p.y, p.x) * 8.0) * 0.5; }',
    'float shadeMul(vec3 p){ vec2 q = vec2(length(p.xy) - 0.4, p.z); return 0.88 + 0.12 * smoothstep(0.15, 0.35, abs(fract(atan(q.y, q.x) * 1.9099) - 0.5)); }'),
    pBody, [0, 0.9, 0.03], [Math.PI / 2 + 0.16, 0, 0], [1, 1, 2]);
  // Tied the way cartoon scarves are drawn: both ends come out of a coiled knot, one lying over
  // the other and hanging lower, squeezed narrow at the knot and widening as they fall, fringed.
  const end = (points, lift) => {
    const s = strip(points.map(([x, y]) => onBelly(x, y, lift)), 0.11, 0.17, 0.04, 28);
    part(...twoTone(s.geo, PALETTE.scarf, PALETTE.scarf2,
      'float regionField(vec3 p){ return sin(3.14159 * p.y / 0.07) * 0.5; }',
      'float shadeMul(vec3 p){ return 0.88 + 0.12 * smoothstep(0.15, 0.35, abs(fract(p.x / 0.034) - 0.5)); }'),
      pBody);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 5; i++) {   // fringe, continuing the strip's direction
      const tassel = part(new THREE.CylinderGeometry(0.011, 0.007, 0.09, 5), mat(PALETTE.scarf), pBody, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
      tassel.quaternion.setFromUnitVectors(up, s.dir.clone().negate());
      tassel.position.copy(s.end).addScaledVector(s.side, (i - 2) * s.width * 0.2).addScaledVector(s.dir, 0.045);
    }
  };
  end([[0.25, 0.8], [0.28, 0.66], [0.3, 0.5], [0.31, 0.32]], 0.03);   // under end, hangs lower
  end([[0.19, 0.8], [0.16, 0.68], [0.14, 0.54], [0.13, 0.42]], 0.075); // over end
  // the coiled knot: two overlapping wraps
  part(ball(0.085, 16, 12), mat(PALETTE.scarf), pBody, [0.21, 0.82, 0.43], [0.3, 0, 0.5], [1.3, 0.85, 0.75]);
  part(ball(0.07, 16, 12), mat(PALETTE.scarf2), pBody, [0.25, 0.78, 0.44], [0.3, 0, -0.4], [1.2, 0.8, 0.7]);
}

// ---------- looks: hats, hair, headset, tie, gilet, held items ----------
// All variants are built up front and switched with setLook(), so a pooled penguin can be
// re-dressed every time it re-enters without creating or leaking geometry.
function buildLooks(head, pBody, body, leftHand, rightHand) {
  const hats = {}, hairs = {}, items = {}, hatParts = [], itemParts = [];
  const topY = HR * HEAD_SCALE[1];
  // chef's toque: a pleated band with a trim at its foot, under a puffed top of soft lobes
  hats.chef = new THREE.Group(); hats.chef.position.set(0, topY, 0.01); head.add(hats.chef);
  const linen = mat('#f7f5f0');
  part(shared.toqueBand, linen, hats.chef, [0, 0.1, 0]);
  part(new THREE.TorusGeometry(0.33, 0.028, 8, 40), mat('#e7e2d6'), hats.chef, [0, -0.02, 0], [Math.PI / 2, 0, 0]);
  part(ball(0.3, 24, 16), linen, hats.chef, [0, 0.36, 0], [0, 0, 0], [1.2, 0.72, 1.2]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    part(ball(0.17, 16, 12), linen, hats.chef, [Math.sin(a) * 0.25, 0.33, Math.cos(a) * 0.25], [0, 0, 0], [1, 0.85, 1]);
  }
  part(ball(0.2, 16, 12), linen, hats.chef, [0, 0.47, 0], [0, 0, 0], [1, 0.8, 1]);
  // server's paper cap: white, a red stripe along its foot
  hats.server = new THREE.Group(); head.add(hats.server);
  const crown = (z) => `${(HR * HEAD_SCALE[1]).toFixed(3)} * sqrt(max(0.0, ${(1 - (SERVER_CAP.half / HR) ** 2).toFixed(4)} - pow(${z} / ${(HR * HEAD_SCALE[2]).toFixed(3)}, 2.0))) - 0.02`;
  const foot = `max(${crown('p.z')}, ${crown('0.0')} - ${SERVER_CAP.lift.toFixed(3)})`;   // the same foot line as serverCap()
  part(...twoTone(shared.serverCap, '#f7f5f0', '#c46a5b', `float regionField(vec3 p){ return (p.y - (${foot})) - 0.045; }`), hats.server);
  // beanie: a knitted cap with a rolled rim and a pom-pom
  hats.beanie = new THREE.Group(); head.add(hats.beanie);
  hatParts.push(part(new THREE.SphereGeometry(0.52, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), mat('#c46a5b'), hats.beanie, [0, 0.01, 0.01], [-0.12, 0, 0], [1, 0.95, 1]));
  hatParts.push(part(new THREE.TorusGeometry(0.47, 0.06, 8, 36), mat('#c46a5b'), hats.beanie, [0, 0.16, 0.06], [Math.PI / 2 - 0.12, 0, 0]));
  part(ball(0.1, 14, 10), mat('#f3f1ec'), hats.beanie, [0, 0.56, -0.05]);
  // baseball cap: crown plus a forward brim
  // A baseball cap: crown, a curved peak tucked under its front, and the strap opening at the back,
  // printed on a patch of sphere that sits just proud of the crown.
  const baseballCap = (colour, tinted) => {
    const cap = new THREE.Group(); head.add(cap);
    const crown = part(new THREE.SphereGeometry(0.515, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), mat(colour), cap, [0, 0.02, 0], [-0.1, 0, 0]);
    const peak = part(shared.capPeak, mat(colour), cap, [0, 0.25, 0.01], [0.1, 0, 0]);   // front edge stays above the eyes and glasses
    if (tinted) hatParts.push(crown, peak);
    const backMat = mapMat(shared.capBack); backMat.transparent = true; backMat.alphaTest = 0.5;
    const back = part(new THREE.SphereGeometry(0.519, 10, 4, Math.PI * 1.5 - 0.45, 0.9, Math.PI * 0.25, Math.PI * 0.15), backMat, cap, [0, 0.02, 0], [-0.1, 0, 0], [1, 1, 1], false);
    back.userData.noLines = true; back.castShadow = false;
    return cap;
  };
  hats.cap = baseballCap('#5f86a6', true);
  // top hat
  hats.tophat = new THREE.Group(); head.add(hats.tophat);
  part(new THREE.CylinderGeometry(0.26, 0.28, 0.44, 24), mat('#3a3f4a'), hats.tophat, [0, topY + 0.2, 0]);
  part(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 28), mat('#3a3f4a'), hats.tophat, [0, topY - 0.01, 0]);
  hatParts.push(part(new THREE.CylinderGeometry(0.285, 0.285, 0.08, 24), mat('#c46a5b'), hats.tophat, [0, topY + 0.05, 0], [0, 0, 0], [1, 1, 1], false));
  // a bellhop's pillbox: a short burgundy drum with a brass band, worn at a tilt. Its rim rests
  // where the crown is exactly as wide as it, so the head's top sits hidden inside it.
  hats.pillbox = new THREE.Group(); hats.pillbox.position.set(0.03, 0, 0.02); hats.pillbox.rotation.set(-0.12, 0, -0.14); head.add(hats.pillbox);
  part(new THREE.CylinderGeometry(0.235, 0.24, 0.17, 28), mat('#8b2e3a'), hats.pillbox, [0, 0.49, 0]);
  part(new THREE.CylinderGeometry(0.245, 0.245, 0.045, 28), mat('#c9a55a'), hats.pillbox, [0, 0.43, 0], [0, 0, 0], [1, 1, 1], false);
  part(ball(0.03, 10, 8), mat('#c9a55a'), hats.pillbox, [0, 0.585, 0], [0, 0, 0], [1, 0.6, 1], false);
  // a bowler: a charcoal dome on a narrow curled brim, with a ribbon round its foot
  hats.bowler = new THREE.Group(); head.add(hats.bowler);
  part(new THREE.SphereGeometry(0.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#34373f'), hats.bowler, [0, 0.37, 0], [0, 0, 0], [1, 0.85, 1]);
  part(new THREE.LatheGeometry([[0.28, 0.0], [0.38, -0.005], [0.41, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 32), mat('#34373f').clone(), hats.bowler, [0, 0.37, 0])
    .material.side = THREE.DoubleSide;
  hatParts.push(part(new THREE.CylinderGeometry(0.303, 0.303, 0.05, 28), mat('#c46a5b'), hats.bowler, [0, 0.4, 0], [0, 0, 0], [1, 1, 1], false));
  // the tech bro's cap: a charcoal baseball cap with a spark badge on the front of the crown
  // fedora: a pinched crown and a wide brim, tipped forward over the eyes
  hats.fedora = new THREE.Group(); hats.fedora.position.set(0, 0.35, 0.02); hats.fedora.rotation.x = 0.16; head.add(hats.fedora);
  const felt = mat('#6b4a2f');
  part(new THREE.CylinderGeometry(0.2, 0.29, 0.3, 28), felt, hats.fedora, [0, 0.15, 0], [0, 0, 0], [1, 1, 0.92]);
  part(new THREE.LatheGeometry([[0.26, 0.0], [0.47, -0.01], [0.52, 0.035]].map(([r, y]) => new THREE.Vector2(r, y)), 36), felt.clone(), hats.fedora, [0, 0.02, 0])
    .material.side = THREE.DoubleSide;
  part(new THREE.CylinderGeometry(0.284, 0.29, 0.07, 28), mat('#3a2a1c'), hats.fedora, [0, 0.06, 0], [0, 0, 0], [1, 1, 0.92], false);
  part(box(0.05, 0.03, 0.34, 0.015), mat('#57391f'), hats.fedora, [0, 0.29, 0.0], [0, 0, 0], [1, 1, 1], false);   // the crease down the crown
  hats.techcap = baseballCap('#34373f', false);
  const badgeAt = new THREE.Vector3(0, 0.716, 0.698);   // outward from the crown, 40 degrees up its front
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({ map: shared.spark, transparent: true, depthWrite: false }));
  badge.position.copy(badgeAt).multiplyScalar(0.522).add(new THREE.Vector3(0, 0.02, 0));
  badge.lookAt(badge.position.clone().add(badgeAt));
  badge.userData.noLines = true; badge.castShadow = false;
  hats.techcap.add(badge);
  // a hard hat: a safety-yellow dome with a ridge over the crown, on a brim that juts out at the front
  hats.hardhat = new THREE.Group(); hats.hardhat.position.set(0, 0.02, 0.01); hats.hardhat.rotation.x = -0.12; head.add(hats.hardhat);
  const hardYellow = mat('#d8b04e');
  part(new THREE.SphereGeometry(0.54, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), hardYellow, hats.hardhat);
  part(new THREE.CylinderGeometry(0.57, 0.57, 0.03, 32), hardYellow, hats.hardhat, [0, 0.13, 0.05], [0, 0, 0], [1, 1, 1.1]);
  part(box(0.1, 0.07, 0.8, 0.03), hardYellow, hats.hardhat, [0, 0.53, 0], [0, 0, 0], [1, 1, 1], false);
  // a food-hall hairnet: a puffy white cap gathered on an elastic band, the net printed on it
  hats.hairnet = new THREE.Group(); hats.hairnet.rotation.x = -0.1; head.add(hats.hairnet);
  const netMat = mapMat(shared.net);
  part(new THREE.SphereGeometry(0.53, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.38), netMat, hats.hairnet, [0, 0.02, 0], [0, 0, 0], [1, 1.02, 1]);
  part(new THREE.TorusGeometry(0.5, 0.026, 8, 36), mat('#e3e7e8'), hats.hairnet, [0, 0.2, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);

  // hair: the classic three-spike tuft, a single curl, or a forward swoop
  hairs.spikes = new THREE.Group(); hairs.spikes.position.set(0, topY - 0.02, 0.02); head.add(hairs.spikes);
  for (const [x, tilt] of [[-0.045, 0.45], [0, 0.05], [0.045, -0.4]]) part(new THREE.ConeGeometry(0.035, 0.17, 4), role('penguin'), hairs.spikes, [x, 0.07, 0], [0, 0, tilt]);
  hairs.curl = new THREE.Group(); hairs.curl.position.set(0, topY + 0.02, 0.04); head.add(hairs.curl);
  part(new THREE.TorusGeometry(0.075, 0.028, 8, 16, Math.PI * 1.6), role('penguin'), hairs.curl, [0, 0.08, 0], [0, Math.PI / 2, 0]);
  hairs.swoop = new THREE.Group(); hairs.swoop.position.set(0, topY - 0.03, 0.1); head.add(hairs.swoop);
  part(new THREE.ConeGeometry(0.07, 0.3, 8), role('penguin'), hairs.swoop, [0, 0.1, 0.06], [1.05, 0, 0]);

  // headset: band over the head, ear cup, boom mic towards the beak
  const headset = new THREE.Group(); head.add(headset);
  part(new THREE.TorusGeometry(0.5, 0.028, 8, 32, Math.PI), role('pole'), headset, [0, 0.02, 0], [0, 0, 0], [1, 0.95, 1]);
  for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), role('pole'), headset, [s * 0.5, 0, 0], [0, 0, Math.PI / 2]);
  const boom = part(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), role('pole'), headset, [0.38, -0.2, 0.26], [0.9, 0, 0.65]);
  part(ball(0.045, 10, 8), role('pole'), boom, [0, 0.22, 0]);

  // tie: knot plus blade, lying on the belly
  const tie = new THREE.Group(); tie.position.set(0, 0.74, 0.475); tie.rotation.x = -0.27; pBody.add(tie);   // tilted to follow the belly's bulge, just clear of it
  const tieParts = [part(box(0.08, 0.06, 0.05, 0.015), mat('#c46a5b'), tie), part(shared.tie, mat('#c46a5b'), tie, [0, -0.02, -0.01])];
  // bow tie: a knot and two wings, high on the chest just under the chin
  const bowtie = new THREE.Group(); bowtie.position.set(0, 0.79, 0.43); bowtie.rotation.x = -0.35; pBody.add(bowtie);
  const bowParts = [part(box(0.05, 0.05, 0.04, 0.015), mat('#1f2126'), bowtie)];
  for (const s of [-1, 1]) bowParts.push(part(new THREE.ConeGeometry(0.065, 0.13, 12), mat('#1f2126'), bowtie, [s * 0.075, 0, -0.005], [0, 0, s * Math.PI / 2], [1, 1, 0.45]));
  // pearls: a string of beads draped round the neck, lowest at the front, resting on the body
  const pearls = new THREE.Group(); body.add(pearls);
  const bodyRadiusAt = (y) => {
    for (let i = 1; i < BODY_PROFILE.length; i++) {
      const a = BODY_PROFILE[i - 1], b = BODY_PROFILE[i];
      if (y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    }
    return 0;
  };
  for (let i = 0; i <= 16; i++) {
    const phi = -1.25 + (2.5 * i) / 16, y = 0.8 - 0.15 * Math.cos(phi * 1.2);
    const r = bodyRadiusAt(y) + 0.025;
    part(ball(0.03, 10, 8), mat('#f4efe4'), pearls, [Math.sin(phi) * r, y, Math.cos(phi) * r], [0, 0, 0], [1, 1, 1], false).castShadow = false;
  }
  // a burglar's mask round the eyes
  const maskMat = mapMat(shared.mask); maskMat.transparent = true; maskMat.alphaTest = 0.5; maskMat.side = THREE.DoubleSide;
  const mask = part(new THREE.SphereGeometry(HR, 48, 4, 0, Math.PI * 2, MASK_BAND.thetaStart, MASK_BAND.thetaLength), maskMat, head, [0, 0, 0], [0, 0, 0], HEAD_SCALE.map((k) => k * 1.03), false);
  mask.userData.noLines = true; mask.castShadow = false;

  // gilet: a padded vest zipped most of the way, a strip of belly showing down the middle.
  // Quilted seams, a zip along each front edge and a stand-up collar. It rides on the body's stretch.
  const OPEN = 0.3;   // half-width of the front opening, in radians round the body
  const vestProfile = [[0.6, 0.3], [0.645, 0.36], [0.615, 0.58], [0.515, 0.78], [0.44, 0.84]];
  const vestMat = mat('#56657a').clone(); vestMat.side = THREE.DoubleSide;
  const vest = part(new THREE.LatheGeometry(vestProfile.map(([r, y]) => new THREE.Vector2(r, y)), 32, OPEN, Math.PI * 2 - 2 * OPEN), vestMat, body);
  const collarMat = mat('#4a586b').clone(); collarMat.side = THREE.DoubleSide;
  part(new THREE.LatheGeometry([[0.44, 0.83], [0.46, 0.9], [0.49, 0.965]].map(([r, y]) => new THREE.Vector2(r, y)), 32, OPEN, Math.PI * 2 - 2 * OPEN), collarMat, vest);
  const radiusAt = (y) => {   // the vest's radius at a height, read off its profile
    for (let i = 1; i < vestProfile.length; i++) {
      const [r0, y0] = vestProfile[i - 1], [r1, y1] = vestProfile[i];
      if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
    return vestProfile[vestProfile.length - 1][0];
  };
  const onVest = (phi, y, lift = 0.006) => new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).multiplyScalar(radiusAt(y) + lift).setY(y);
  const seam = mat('#3d4859');
  for (const y of [0.46, 0.64]) {   // quilting
    const ring = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => onVest(OPEN + (i / 24) * (Math.PI * 2 - 2 * OPEN), y)));
    part(new THREE.TubeGeometry(ring, 48, 0.008, 4, false), seam, vest, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
  }
  for (const side of [-1, 1]) {   // zip teeth along both front edges
    const edge = new THREE.CatmullRomCurve3([0.31, 0.45, 0.6, 0.72, 0.83].map((y) => onVest(side * OPEN, y, 0.008)));
    part(new THREE.TubeGeometry(edge, 16, 0.013, 5, false), mat(INK), vest, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
  }
  const pull = onVest(OPEN, 0.76, 0.02);   // the zip pull, left dangling from the right-hand edge
  part(box(0.03, 0.07, 0.012, 0.005), role('remote'), vest, [pull.x, pull.y - 0.02, pull.z], [0, OPEN, 0], [1, 1, 1], false);
  // hi-vis: the same vest in orange, with two reflective bands round it
  const hivis = new THREE.Group(); vest.add(hivis);
  for (const y of [0.47, 0.63]) {
    const band = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => onVest(OPEN + (i / 24) * (Math.PI * 2 - 2 * OPEN), y, 0.012)));
    part(new THREE.TubeGeometry(band, 48, 0.026, 4, false), mat('#d9dde0'), hivis, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
  }
  const VEST = { plain: ['#56657a', '#4a586b'], hivis: ['#e07f3c', '#c96a2e'] };

  // trench coat: long and belted, open down the front over the belly, collar turned up
  const COAT_OPEN = 0.42;
  const coatProfile = [[0.45, 0.03], [0.6, 0.15], [0.648, 0.36], [0.618, 0.58], [0.52, 0.78], [0.44, 0.84]];
  const coatMat = mat('#8a6a45').clone(); coatMat.side = THREE.DoubleSide;
  const coat = part(new THREE.LatheGeometry(coatProfile.map(([r, y]) => new THREE.Vector2(r, y)), 32, COAT_OPEN, Math.PI * 2 - 2 * COAT_OPEN), coatMat, body);
  part(new THREE.LatheGeometry([[0.44, 0.82], [0.5, 0.92], [0.56, 1.02]].map(([r, y]) => new THREE.Vector2(r, y)), 32, COAT_OPEN + 0.25, Math.PI * 2 - 2 * COAT_OPEN - 0.5), coatMat.clone(), coat);
  const coatDark = mat('#5e4529');
  part(new THREE.TorusGeometry(0.645, 0.028, 6, 40), coatDark, coat, [0, 0.42, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);   // the belt, done up across the front
  part(box(0.1, 0.08, 0.03, 0.01), mat('#c9a55a'), coat, [0, 0.42, 0.655], [0, 0, 0], [1, 1, 1], false);
  // sleeves: the flippers would vanish inside the coat, so each gets a sleeve a shade darker than
  // it, stopping short of the tip so the flipper shows at the cuff
  const sleeveMat = mat('#7a5c3b').clone(); sleeveMat.side = THREE.DoubleSide;
  const sleeves = [leftHand, rightHand].map((hand) => {
    const sleeve = part(shared.flipper, sleeveMat, hand, [0, 0.02, 0], [0, 0, 0], [0.46, 0.78, 1.12], false);
    sleeve.castShadow = false;
    return sleeve;
  });
  for (const y of [0.54, 0.66]) for (const s of [-1, 1]) {   // double-breasted buttons
    const phi = s * (COAT_OPEN + 0.12), r = 0.64 - (y - 0.36) * 0.12;
    part(ball(0.025, 8, 6), coatDark, coat, [Math.sin(phi) * r, y, Math.cos(phi) * r], [0, 0, 0], [1, 1, 1], false);
  }

  // A folded newspaper tucked under the left flipper, between flipper and body. It moves with the
  // flipper, so it can never reach the floor the way something hanging from the tip would.
  items.newspaper = new THREE.Group(); leftHand.add(items.newspaper);
  part(box(0.035, 0.34, 0.58, 0.012), mapMat(shared.newsprint), items.newspaper, [0.085, -0.3, 0.03]);   // just inside the flipper, never through it
  // an inspector's clipboard, tucked under the same way: a board, a sheet of ticks, a steel clip
  items.clipboard = new THREE.Group(); leftHand.add(items.clipboard);
  part(box(0.03, 0.42, 0.32, 0.012), mat('#8c6448'), items.clipboard, [0.085, -0.3, 0.05]);
  part(box(0.012, 0.36, 0.27, 0.004), mat('#f7f5f0'), items.clipboard, [0.105, -0.32, 0.05], [0, 0, 0], [1, 1, 1], false);
  part(box(0.03, 0.05, 0.12, 0.01), mat('#b4bec3'), items.clipboard, [0.1, -0.1, 0.05], [0, 0, 0], [1, 1, 1], false);

  // other held items hang from the left flipper tip and stay upright; all of them clear the floor
  const hang = new THREE.Group(); hang.position.set(0, -0.6, 0.03); hang.rotation.z = 0.4; leftHand.add(hang);
  items.coffee = new THREE.Group(); hang.add(items.coffee);
  part(new THREE.CylinderGeometry(0.075, 0.06, 0.18, 14), mat('#f3f1ec'), items.coffee, [0, 0.02, 0.04]);
  itemParts.push(part(new THREE.CylinderGeometry(0.078, 0.07, 0.07, 14), mat('#8c6448'), items.coffee, [0, 0.01, 0.04], [0, 0, 0], [1, 1, 1], false));
  // closed umbrella tucked under the flipper like the paper, tip pointing forward and a little down,
  // crook handle behind. Along the umbrella's own z: the tip is +z, the handle -z.
  items.umbrella = new THREE.Group(); items.umbrella.position.set(0.06, -0.32, 0); items.umbrella.rotation.x = 0.22; leftHand.add(items.umbrella);
  part(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), role('pole'), items.umbrella, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);
  const furled = [[0.012, -0.16], [0.05, -0.1], [0.068, 0.05], [0.05, 0.3], [0.014, 0.44]].map(([r, y]) => new THREE.Vector2(r, y));
  itemParts.push(part(new THREE.LatheGeometry(furled, 8), mat('#4a5068'), items.umbrella, [0, 0, 0], [Math.PI / 2, 0, 0]));
  part(new THREE.TorusGeometry(0.066, 0.012, 5, 16), role('pole'), items.umbrella, [0, 0, 0.1], [0, 0, 0], [1, 1, 1], false);   // the strap
  part(new THREE.CylinderGeometry(0.006, 0.01, 0.08, 5), role('pole'), items.umbrella, [0, 0, 0.52], [Math.PI / 2, 0, 0], [1, 1, 1], false);
  const crook = new THREE.CatmullRomCurve3([[0, 0, -0.46], [0, 0, -0.53], [0, -0.03, -0.58], [0, -0.08, -0.595], [0, -0.12, -0.57], [0, -0.13, -0.52]].map((v) => new THREE.Vector3(...v)));
  part(new THREE.TubeGeometry(crook, 12, 0.02, 6, false), mat('#8c6448'), items.umbrella);
  items.balloon = new THREE.Group(); hang.add(items.balloon);
  part(new THREE.CylinderGeometry(0.006, 0.006, 1.5, 4), role('pole'), items.balloon, [0.05, 0.75, 0], [0, 0, -0.08], [1, 1, 1], false);
  itemParts.push(part(ball(0.19, 18, 14), mat('#c46a5b'), items.balloon, [0.12, 1.62, 0], [0, 0, 0], [1, 1.2, 1]));

  // right flipper: a plate of fish (customers) or a spatula (chefs)
  const dish = new THREE.Group(); dish.position.set(0.02, -0.66, 0.08); rightHand.add(dish);
  part(new THREE.CylinderGeometry(0.17, 0.14, 0.03, 20), mat('#f3f1ec'), dish);
  part(ball(0.1, 14, 10), mat('#e08c6a'), dish, [0, 0.06, 0], [0, 0, 0], [1.7, 0.6, 0.9]);
  part(new THREE.ConeGeometry(0.06, 0.1, 4), mat('#e08c6a'), dish, [-0.2, 0.06, 0], [0, 0, Math.PI / 2], [1, 1, 0.4]);
  const spatula = new THREE.Group(); spatula.position.set(0.02, -0.62, 0.05); rightHand.add(spatula);
  part(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), mat('#8c6448'), spatula, [0, -0.1, 0]);
  part(box(0.14, 0.02, 0.16, 0.01), role('pole'), spatula, [0, -0.28, 0.02]);
  // things carried out on a raised right flipper, like the plate of fish: a coffee to go, fresh
  // towels, a letter, or a burglar's sack. Built level for a flipper raised to -1.2.
  const carry = new THREE.Group(); carry.position.set(0.02, -0.64, 0.08); rightHand.add(carry);
  const carried = { coffee: new THREE.Group(), towel: new THREE.Group(), letter: new THREE.Group(), note: new THREE.Group(), gold: new THREE.Group() };
  for (const g of Object.values(carried)) carry.add(g);
  part(new THREE.CylinderGeometry(0.075, 0.058, 0.2, 14), mat('#f3f1ec'), carried.coffee, [0, 0.1, 0]);
  part(new THREE.CylinderGeometry(0.078, 0.07, 0.07, 14), mat('#8c6448'), carried.coffee, [0, 0.09, 0], [0, 0, 0], [1, 1, 1], false);
  part(new THREE.CylinderGeometry(0.082, 0.078, 0.035, 14), mat('#3a3f4a'), carried.coffee, [0, 0.215, 0]);
  part(box(0.34, 0.06, 0.24, 0.025), mat('#f3f1ec'), carried.towel, [0, 0.03, 0]);
  part(box(0.34, 0.06, 0.24, 0.025), mat('#d8e3e6'), carried.towel, [0, 0.09, 0]);
  part(box(0.3, 0.015, 0.2, 0.005), mat('#f1e6c8'), carried.letter, [0, 0.01, 0]);
  part(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12), mat('#c0392b'), carried.letter, [0, 0.022, 0], [0, 0, 0], [1, 1, 1], false);
  part(box(0.22, 0.012, 0.28, 0.004), mat('#ffffff'), carried.note, [0, 0.01, 0]);   // a plain note: what a runner carries once the desk has opened the letter
  part(ball(0.17, 16, 12), mat('#9a8a6e'), carried.gold, [0, 0.15, 0], [0, 0, 0], [1, 0.9, 1]);
  part(new THREE.ConeGeometry(0.07, 0.12, 10), mat('#9a8a6e'), carried.gold, [0, 0.33, 0], [Math.PI, 0, 0]);
  part(new THREE.TorusGeometry(0.045, 0.014, 6, 12), mat('#6b5a44'), carried.gold, [0, 0.29, 0], [Math.PI / 2, 0, 0], [1, 1, 1], false);

  const all = [...Object.values(hats), ...Object.values(hairs), headset, tie, bowtie, pearls, mask, vest, hivis, coat, ...sleeves, ...Object.values(items), dish, spatula, ...Object.values(carried)];
  all.forEach((g) => (g.visible = false));
  return { hats, hairs, items, headset, tie, tieParts, bowtie, bowParts, pearls, mask, vest, vestMat, collarMat, hivis, VEST, coat, sleeves, dish, spatula, carry, carried, hatParts, itemParts };
}

// ---------- the penguin ----------
// opts.seated: sitting on something (feet poke forward). opts.scarf: the main penguin's scarf.
export function makePenguin({ seated = false, scarf = false } = {}) {
  sharedGeometry();
  const root = new THREE.Group();
  const pBody = new THREE.Group(); root.add(pBody);
  const body = part(...twoTone(new THREE.LatheGeometry(BODY_PROFILE, 28), PALETTE.penguin, PALETTE.belly,
    'float regionField(vec3 p){ return pow(atan(p.x, p.z) / 0.82, 2.0) + pow((p.y - 0.4) / 0.44, 2.0) - 1.0; }'),
    pBody, [0, 0, 0], [0, 0, 0], [1, 1, 0.9]);

  const face = {
    uMood: { value: 0.72 }, uHappy: { value: 0 }, uBlink: { value: 1 }, uBrowAngle: { value: 0.45 }, uBrowLift: { value: 0 },
    uBlush: { value: new THREE.Color(PALETTE.blush) },
  };
  const head = new THREE.Group(); head.position.set(0, 1.22, 0.02); pBody.add(head);
  part(...twoTone(new THREE.SphereGeometry(HR, 36, 26), PALETTE.penguin, PALETTE.belly, MASK_FIELD, NO_SHADE, {
    uniforms: face, decl: 'uniform float uMood, uHappy, uBlink, uBrowAngle, uBrowLift;\nuniform vec3 uBlush;\n', code: FACE_CODE,
  }), head, [0, 0, 0], [0, 0, 0], HEAD_SCALE);
  // A point on the head's surface at (azimuth, elevation), lifted off it by `lift`.
  const headPoint = (a, e, lift = 0) => {
    const r = HR + lift;
    return new THREE.Vector3(r * Math.cos(e) * Math.sin(a) * HEAD_SCALE[0], r * Math.sin(e) * HEAD_SCALE[1], r * Math.cos(e) * Math.cos(a) * HEAD_SCALE[2]);
  };
  // Places a feature on the head's surface with its +z facing outwards.
  const onHead = (obj, a, e, lift = 0) => {
    obj.position.copy(headPoint(a, e, lift));
    obj.lookAt(obj.position.clone().multiplyScalar(2));
    head.add(obj);
    return obj;
  };
  // Beak: a tapered, round-tipped shape that droops a little, upper half over a smaller jaw.
  // No hull outline: its flat base would show as a ring on the face; the crease pass inks the join.
  const beak = onHead(new THREE.Group(), 0, -0.07, -0.03);
  part(shared.upperBeak, role('beak'), beak, [0, 0.015, -0.01], [Math.PI / 2 + 0.12, 0, 0], [1.15, 1, 0.62], false);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.015, 0.0); beak.add(jaw);
  part(shared.lowerBeak, role('beakDark'), jaw, [0, -0.012, -0.005], [Math.PI / 2 + 0.2, 0, 0], [1, 1, 0.5], false);

  if (scarf) addScarf(pBody);

  // Flippers are thin: a hull outline would cover most of them and the body's shadow darkens them,
  // so they skip both (the crease-line pass still inks their edges) and match the body's tone. They
  // cast no shadow either: lying against the body, their shadow lands on it as a dark oval.
  const leftFlipper = new THREE.Group(); leftFlipper.position.set(-0.5, 0.74, 0); leftFlipper.rotation.z = -0.4; pBody.add(leftFlipper);
  const rightFlipper = new THREE.Group(); rightFlipper.position.set(0.5, 0.74, 0.05); rightFlipper.rotation.z = 0.4; pBody.add(rightFlipper);
  for (const f of [leftFlipper, rightFlipper]) {
    const flipper = part(shared.flipper, role('penguin'), f, [0, 0, 0], [0, 0, 0], [0.38, 1, 1], false);
    flipper.receiveShadow = flipper.castShadow = false;
  }

  // Feet: flat webbed paddles with three rounded toes, soft bevelled edges.
  const placeFoot = (foot, side) => {
    if (seated) { foot.position.set(side * 0.2, 0.06, 0.44); foot.rotation.set(-0.35, side * 0.25, 0); }
    else { foot.position.set(side * 0.2, 0.03, 0.26); foot.rotation.set(0, side * 0.2, 0); }
  };
  const feet = [-1, 1].map((side) => {
    const foot = new THREE.Group();
    placeFoot(foot, side);
    root.add(foot);
    part(shared.foot, role('beak'), foot, [0, 0.03, -0.06], [Math.PI / 2, 0, 0], [1.25, 1.25, 1]);
    return foot;
  });
  let footRestX = feet[0].rotation.x;

  // Mood icons. An anime anger mark on the temple: four bracket strokes with corners to the centre
  // and ends flaring open, built flat then bent to the head's curve so it reads as a vein on the skin.
  const anger = onHead(new THREE.Group(), 1.3, 0.6, 0.02);
  const onHeadCurve = (geo) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, pos.getZ(i) - (x * x + y * y) / (2 * HR));
    }
    geo.computeVertexNormals();
    return geo;
  };
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const gap = 0.026, reach = 0.1, flare = 0.018;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(sx * (gap + flare), sy * reach, 0), new THREE.Vector3(sx * gap * 0.6, sy * gap * 0.6, 0), new THREE.Vector3(sx * reach, sy * (gap + flare), 0));
    const tube = new THREE.TubeGeometry(curve, 20, 0.016, 8, false);
    const pos = tube.attributes.position, centre = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {   // taper both ends of the stroke
      const k = Math.floor(i / 9) / 20;
      curve.getPoint(k, centre);
      v.fromBufferAttribute(pos, i).sub(centre).multiplyScalar(0.55 + 0.45 * Math.sin(Math.PI * k)).add(centre);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    part(onHeadCurve(tube), role('anger'), anger, [0, 0, 0], [0, 0, 0], [1, 1, 1], false).castShadow = false;
    for (const k of [0, 1]) {   // round caps on the open ends
      const tip = curve.getPoint(k);
      part(ball(0.009, 8, 6), role('anger'), anger, [tip.x, tip.y, -(tip.x ** 2 + tip.y ** 2) / (2 * HR)], [0, 0, 0], [1, 1, 1], false);
    }
  }
  // The anger mark is "painted on", so the crease-line pass skips it (it would get an ink ring).
  anger.traverse((o) => { if (o.isMesh) o.userData.noLines = true; });
  // Hearts and Z's are cartoon symbols, not objects in the room, so they cast no shadow.
  const hearts = [0, 1, 2].map(() => {
    const h = part(shared.heart, role('blush'), root, [0, 2, 0]);
    h.castShadow = false;
    return h;
  });
  const zs = [0, 1, 2].map(() => {
    const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.zTexture, transparent: true, depthWrite: false }));
    z.userData.noLines = true; root.add(z);
    return z;
  });

  // Both bubbles hang from the tip of their tail, straight above the head: a sprite always faces
  // the camera, so the bubble sits up and to the right on screen whichever way the penguin faces.
  // (An offset in the penguin's own frame swings round with it, in front, behind or to the left.)
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.grawlix[0], transparent: true, depthWrite: false }));
  bubble.center.set(26 / 160, 8 / 120);   // the swearing bubble's tail tip, in its texture
  bubble.userData.noLines = true; bubble.visible = false; root.add(bubble);
  // A speech bubble with a picture in it (bubbles.js), shown for a few seconds by say().
  const speech = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  speech.center.set(30 / 192, 8 / 144);   // its tail tip (bubbles.js draws the tail there)
  speech.userData.noLines = true; speech.visible = false; root.add(speech);
  // Dizzy stars circling a knocked-out head. They ride on the head, so they follow it to the floor.
  const starCentre = new THREE.Vector3(), starAt = new THREE.Vector3();
  const stars = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.star, transparent: true, depthWrite: false }));
    s.userData.noLines = true; s.visible = false; head.add(s);
    return s;
  });

  // Glasses sit just off the face over the painted eyes. The frames are thin, so no hull (like the
  // flippers); sunglasses add dark lenses with a glint. Arms run back round the head to the ears.
  const glasses = { round: new THREE.Group(), sun: new THREE.Group() };
  const rim = new THREE.TorusGeometry(0.088, 0.013, 6, 28);
  for (const [kind, g] of Object.entries(glasses)) {
    head.add(g);
    const frame = kind === 'sun' ? mat(INK) : role('pole');
    for (const side of [-1, 1]) {
      const eye = onHead(new THREE.Group(), side * 0.3, 0.09, 0.035);
      g.add(eye);
      part(rim, frame, eye, [0, 0, 0], [0, 0, 0], [1, 0.9, 1], false);
      if (kind === 'sun') {
        part(new THREE.CircleGeometry(0.087, 24), mat('#2a2d35'), eye, [0, 0, -0.004], [0, 0, 0], [1, 0.9, 1], false);
        part(box(0.07, 0.014, 0.004, 0.002), mat('#f3f1ec'), eye, [-0.02, 0.03, 0.003], [0, 0, 0.6], [1, 1, 1], false);
      }
      const arm = new THREE.CatmullRomCurve3([0.47, 0.8, 1.15, 1.5].map((a) => headPoint(side * a, 0.1, 0.03)));
      part(new THREE.TubeGeometry(arm, 12, 0.011, 5, false), frame, g, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
    }
    const bridge = onHead(new THREE.Group(), 0, 0.12, 0.05);
    g.add(bridge);
    part(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 5), frame, bridge, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], false);
    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    g.visible = false;
  }

  const looks = buildLooks(head, pBody, body, leftFlipper, rightFlipper);
  looks.glasses = glasses;
  looks.hairs.spikes.visible = true;

  const p = {
    root, pBody, head, jaw, leftFlipper, rightFlipper, feet, looks,
    expression: 'neutral',   // 'annoyed' | 'neutral' | 'happy' | 'evil' (a sly, snickering grin)
    showHearts: true,        // hearts float while happy (a caller can switch them off)
    asleep: false, footTap: false, walking: false,
    cursing: false,          // meltdown: flailing flippers, stomping, a scribbled "#@$%!" bubble
    dizzy: false,            // knocked out: eyes shut, stars circling the head
    panicking: false,        // flapping about with the beak hanging open (a carried item stays held)
    saying: null, sayT: 0, sayAge: 0, shownSay: null,
    mood: 0.72, happy: 0, walkPhase: 0, pace: 1,
    // Show a speech bubble with a picture (a key of bubbles.js) for a few seconds.
    say(key, seconds = 2) { if (p.saying !== key || p.sayT <= 0) p.sayAge = 0; p.saying = key; p.sayT = seconds; },
    // Re-dress the penguin: hat, hair, glasses, headset, tie, gilet or trench coat, held item and height.
    setLook({ hat = null, hatColor, hair = 'spikes', glasses = null, headset = false, tie = null, bowtie = null, pearls = false, mask = false, vest = false, hivis = false, coat = false, item = null, itemColor, height = 1, stretch = 1 } = {}) {
      for (const [k, g] of Object.entries(looks.hats)) g.visible = k === hat;
      for (const [k, g] of Object.entries(looks.hairs)) g.visible = !hat && k === hair;
      if (hatColor) looks.hatParts.forEach((m) => (m.material = mat(hatColor)));
      for (const [k, g] of Object.entries(looks.glasses)) g.visible = k === glasses;
      looks.headset.visible = headset;
      looks.vest.visible = vest || hivis;
      looks.hivis.visible = hivis;
      const [vestHex, collarHex] = looks.VEST[hivis ? 'hivis' : 'plain'];
      looks.vestMat.color.set(vestHex); looks.collarMat.color.set(collarHex);
      looks.coat.visible = coat; looks.sleeves.forEach((m) => (m.visible = coat));
      looks.tie.visible = !!tie;
      if (tie) looks.tieParts.forEach((m) => (m.material = mat(tie)));
      looks.bowtie.visible = !!bowtie;
      if (bowtie) looks.bowParts.forEach((m) => (m.material = mat(bowtie)));
      looks.pearls.visible = pearls;
      looks.mask.visible = mask;
      for (const [k, g] of Object.entries(looks.items)) g.visible = k === item;
      if (itemColor) looks.itemParts.forEach((m) => (m.material = mat(itemColor)));
      root.scale.setScalar(height);
      // A taller or shorter torso; the head, flippers and tie ride on top of it.
      body.scale.y = stretch;
      head.position.y = 1.22 + 0.98 * (stretch - 1);
      leftFlipper.position.y = rightFlipper.position.y = 0.74 * stretch;
      looks.tie.position.y = 0.74 * stretch;
      looks.bowtie.position.y = 0.79 * stretch;
    },
    // What's carried on the raised right flipper: 'coffee', 'towel', 'letter', 'note', 'gold' or null.
    carry(kind) { for (const [k, g] of Object.entries(looks.carried)) g.visible = k === kind; },
    setMood(expression) { p.expression = expression; },
    // Opt-in: sit down or stand up after being made (World 7's office chairs). A penguin nobody
    // calls this on stays as makePenguin({ seated }) made it.
    setSeated(on) {
      seated = on;
      feet.forEach((foot, i) => placeFoot(foot, i ? 1 : -1));
      footRestX = feet[0].rotation.x;
    },
    update(t, dt) {
      // evil borrows the grumpy face's slanted lids and brows: sly half-shut eyes under a frown
      const evil = p.expression === 'evil';
      // panic pushes the mood past cheerful: brows lifted and tilted up in the middle, eyes wide
      const target = p.panicking ? 1.4 : p.expression === 'annoyed' ? 0 : p.expression === 'happy' ? 1 : evil ? 0.15 : 0.72;
      p.mood += (target - p.mood) * Math.min(dt * 3, 1);
      const happy = p.expression === 'happy';
      p.happy += ((happy ? 1 : 0) - p.happy) * Math.min(dt * 12, 1);
      const blink = p.asleep || p.dizzy ? 0.12 : !happy && t % 3.7 < 0.12 ? 0.15 : 1;
      face.uMood.value = p.mood;
      face.uHappy.value = p.happy;
      face.uBlink.value = blink;
      face.uBrowAngle.value = lerp(0.6, -0.08, p.mood);
      face.uBrowLift.value = lerp(-0.01, 0.06, p.mood);
      // annoyed: slumped, chin-down glare. happy: bopping along, beak open. walking: a waddle.
      pBody.rotation.x = lerp(-0.12, 0, p.mood);
      if (p.walking) {
        p.walkPhase += dt * 9 * p.pace;   // shorter, slower steps while easing in behind someone
        pBody.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.06;
        pBody.rotation.z = Math.sin(p.walkPhase) * 0.12;
        feet.forEach((f, i) => (f.position.y = 0.03 + Math.max(0, Math.sin(p.walkPhase + i * Math.PI)) * 0.08));
      } else {
        pBody.position.y = happy ? Math.abs(Math.sin(t * 5.5)) * 0.05 : evil ? Math.abs(Math.sin(t * 16)) * 0.02 : 0;   // shoulders shaking with a snicker
        pBody.rotation.z = happy ? Math.sin(t * 2.75) * 0.05 : 0;
        feet.forEach((f) => (f.position.y = seated ? 0.06 : 0.03));
      }
      head.rotation.x = lerp(0.14, -0.06, p.mood) + (p.asleep ? 0.2 : 0);
      head.rotation.z = happy ? Math.sin(t * 2.75 + 0.6) * 0.1 : p.asleep ? Math.sin(t * 0.8) * 0.12 : evil ? 0.14 : -0.05;
      jaw.rotation.x = happy ? 0.2 + Math.max(0, Math.sin(t * 5.5)) * 0.25 : p.cursing ? 0.3 + Math.abs(Math.sin(t * 13)) * 0.3
        : evil ? 0.2 + Math.abs(Math.sin(t * 16)) * 0.1 : p.panicking ? 0.4 : 0;
      feet[1].rotation.x = footRestX + (p.footTap || p.cursing ? Math.max(0, Math.sin(t * 14)) * -0.5 : 0);
      // Meltdown overrides whatever the flippers were doing: both up and flailing, body hopping.
      if (p.cursing) {
        leftFlipper.rotation.set(0, 0, -1.3 - Math.abs(Math.sin(t * 15)) * 0.9);
        rightFlipper.rotation.set(0, 0, 1.3 + Math.abs(Math.sin(t * 15 + 1.2)) * 0.9);
        pBody.position.y = Math.abs(Math.sin(t * 15)) * 0.07;
        pBody.rotation.z = Math.sin(t * 8) * 0.09;
      } else if (p.panicking) {   // flapping; a flipper holding something keeps hold of it
        leftFlipper.rotation.set(0, 0, -1.1 - Math.abs(Math.sin(t * 17)) * 1.0);
        if (!Object.values(looks.carried).some((g) => g.visible)) rightFlipper.rotation.set(0, 0, 1.1 + Math.abs(Math.sin(t * 17 + 1.6)) * 1.0);
        if (!p.walking) pBody.position.y = Math.abs(Math.sin(t * 12)) * 0.06;   // hopping on the spot
      } else leftFlipper.rotation.set(0, 0, -0.4);
      bubble.visible = p.cursing;
      if (p.cursing) {
        bubble.material.map = shared.grawlix[Math.floor(t * 7) % 3];
        const pop = 0.95 + Math.abs(Math.sin(t * 18)) * 0.08;
        bubble.scale.set(1.25 * pop, 0.94 * pop, 1);
        bubble.position.set(0, BUBBLE_Y, 0);
      }
      if (p.sayT > 0) p.sayT -= dt;
      speech.visible = !p.cursing && p.sayT > 0 && !!p.saying;
      if (speech.visible) {
        if (p.shownSay !== p.saying) { speech.material.map = bubbleTexture(p.saying); speech.material.needsUpdate = true; p.shownSay = p.saying; }
        p.sayAge += dt;
        const grow = 0.3 + 0.7 * Math.min(1, p.sayAge / 0.15);   // pops in
        speech.scale.set(0.95 * grow, 0.71 * grow, 1);
        speech.position.set(0, BUBBLE_Y, 0);
      }
      // the stars circle above the head in the room's up, whichever way the head is lying
      if (p.dizzy) head.getWorldPosition(starCentre);
      const size = root.scale.x;
      stars.forEach((s, i) => {
        s.visible = p.dizzy;
        if (!p.dizzy) return;
        const a = t * 3 + (i * Math.PI * 2) / 3;
        s.position.copy(head.worldToLocal(starAt.set(Math.cos(a) * 0.42, 0.5 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.42).multiplyScalar(size).add(starCentre)));
        s.scale.setScalar(0.2);
      });
      anger.visible = p.expression === 'annoyed';
      const throb = 1.1 + Math.pow(Math.abs(Math.sin(t * 4)), 6) * 0.3;
      anger.scale.set(throb, throb, 1);
      hearts.forEach((h, i) => {
        const k = (t * 0.5 + i / 3) % 1;
        h.visible = happy && p.showHearts;
        h.position.set(Math.sin((k + i) * 6) * 0.25 + (i - 1) * 0.2, 1.95 + k * 0.9, 0.2);
        h.scale.setScalar(Math.sin(k * Math.PI) * 1.1);
      });
      zs.forEach((z, i) => {   // sleepy Z's drift up and off to the right, on screen
        const k = (t * 0.4 + i / 3) % 1, size = 0.18 + k * 0.14;
        z.visible = p.asleep;
        z.position.set(0, 1.9 + k * 0.7, 0);
        z.center.set(0.5 - (0.35 + k * 0.4) / size, 0.5);   // the sideways drift, in the sprite's own units
        z.scale.setScalar(size);
        z.material.opacity = Math.sin(k * Math.PI);
      });
    },
  };
  return p;
}
