// The booth, seen from the inspector's chair: the desk in front, the window,
// and the traveller standing beyond it. Built from the Fang Street penguin cast
// (ADR-6), loaded through the page's import map (ADR-7). Screen only: the
// booth shows the mood it is given and decides nothing.
import * as THREE from 'three';
import { createEngine, part, box, mat, PALETTE } from '/penguins/engine.js';
import { makePenguin } from '/penguins/penguin.js';

const COLORS = { ground: '#b8a48a', groundBase: '#8c7a63', booth: '#8fb3a8', frame: '#e8e2d4', desk: '#a8794f', deskTop: '#c8955f' };

// Each traveller's single accessory, so he reads at a glance (art direction, section 3).
const LOOKS = {
  max: { scarf: true, look: { hat: 'beanie', hatColor: '#e8743b' } },   // a fan's beanie and scarf
  colin: { scarf: false, look: { hat: 'chef', glasses: 'round' } },     // a food trade
};

// One face per mood, the same for every traveller, so the face is a fair tell.
// Mistral's six moods onto the cast's four expressions plus its body language.
const FACES = {
  neutral: { expression: 'neutral' },
  confident: { expression: 'evil' },               // the sly grin: got away with it
  happy: { expression: 'happy' },
  excited: { expression: 'happy', panicking: true }, // flapping and hopping
  frustrated: { expression: 'annoyed', footTap: true },
  sad: { expression: 'neutral', chinDown: true },
};

const TRAVELLER_AT = new THREE.Vector3(0, 0, -1.1);
const EYE = new THREE.Vector3(0, 1.75, 2.4);
const LOOK_AT = new THREE.Vector3(0, 1.45, -1.1);

function buildBooth(group) {
  // Outside: the ground the travellers stand on.
  part(box(9, 0.3, 6, 0.05), mat(COLORS.ground), group, [0, -0.15, -3]);
  part(box(8.9, 0.5, 5.9, 0.05), mat(COLORS.groundBase), group, [0, -0.55, -3]);
  // The booth's front wall, with the window cut out of it.
  const wall = mat(COLORS.booth);
  const [sill, top, half] = [1.0, 2.3, 1.15];
  part(box(6, sill, 0.16), wall, group, [0, sill / 2, 0]);
  part(box(6, 3.4 - top, 0.16), wall, group, [0, (3.4 + top) / 2, 0]);
  for (const s of [-1, 1]) part(box(3 - half, top - sill, 0.16), wall, group, [s * (3 + half) / 2, (sill + top) / 2, 0]);
  // The window frame.
  const frame = mat(COLORS.frame);
  part(box(half * 2 + 0.16, 0.08, 0.24), frame, group, [0, sill, 0]);
  part(box(half * 2 + 0.16, 0.08, 0.24), frame, group, [0, top, 0]);
  for (const s of [-1, 1]) part(box(0.08, top - sill, 0.24), frame, group, [s * half, (sill + top) / 2, 0]);
  // The desk on the inspector's side, under the window.
  part(box(3.2, 0.1, 1.3, 0.04), mat(COLORS.deskTop), group, [0, sill - 0.05, 0.75]);
  part(box(3.1, sill - 0.1, 1.2, 0.04), mat(COLORS.desk), group, [0, (sill - 0.1) / 2, 0.75]);
  // The booth throws no shadow outside, or the traveller would stand in the dark.
  group.traverse((o) => { o.castShadow = false; });
}

function makeTraveller(id) {
  const style = LOOKS[id] ?? { scarf: false, look: {} };
  const penguin = makePenguin({ scarf: style.scarf });
  penguin.setLook(style.look);
  penguin.showHearts = false;   // hearts are for love (art direction); nobody here is in love
  penguin.root.position.copy(TRAVELLER_AT);
  return penguin;
}

// Returns null if this browser can't draw 3D; the game still works without it.
export function createBooth(container) {
  let engine;
  try {
    engine = createEngine(container);
  } catch {
    return null;
  }
  engine.controls.enabled = false;   // the inspector sits still: no orbiting
  engine.camera.fov = 42;
  const group = new THREE.Group();
  engine.scene.add(group);
  buildBooth(group);
  const dir = EYE.clone().sub(LOOK_AT);
  const fitHalfHeight = dir.length() * Math.tan(THREE.MathUtils.degToRad(engine.camera.fov / 2));
  engine.setWorld({
    group, camTarget: LOOK_AT, startDir: dir, fit: [1.9, fitHalfHeight],
    walls: { backWall: [], sideWall: [], wallAt: -99 },
  });

  let traveller = null;
  let travellerId = null;
  let face = FACES.neutral;
  let talking = false;
  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (traveller) {
      traveller.update(t, dt);
      if (face.chinDown) traveller.head.rotation.x += 0.28;
      // Beak moves while his voice plays.
      if (talking) traveller.jaw.rotation.x = 0.08 + Math.abs(Math.sin(t * 11)) * 0.3;
    }
    engine.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    show(id) {
      if (id === travellerId) return;
      if (traveller) group.remove(traveller.root);
      travellerId = id;
      traveller = id ? makeTraveller(id) : null;
      if (traveller) group.add(traveller.root);
      this.setMood('neutral');
      talking = false;
    },
    setMood(mood) {
      face = FACES[mood] ?? FACES.neutral;
      if (!traveller) return;
      traveller.setMood(face.expression);
      traveller.panicking = Boolean(face.panicking);
      traveller.footTap = Boolean(face.footTap);
    },
    setTalking(on) { talking = on; },
  };
}
