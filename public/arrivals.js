// The penguins who come ashore behind the traveller: when each one sets off and
// where he is along the way. Kept apart from the drawing (scenery.js), with no
// imports, so the tests can run it in Node. Distances are in scene units.

export const GANGWAY_X = -2.2;
export const DECK_Y = 0.6;
export const WALK_Z = -3.95;     // the lane along the ice, well behind the traveller
const START_Z = -6.5;            // just inside the hull, so each one appears out of the ship
const EXIT_X = 4.2;
const GANGWAY_RUN = WALK_Z - START_Z;
export const PATH_LENGTH = GANGWAY_RUN + (EXIT_X - GANGWAY_X);

// Down the gangway towards the inspector, then a left turn along the lane.
export function pointAt(distance) {
  if (distance <= GANGWAY_RUN) {
    return { x: GANGWAY_X, y: DECK_Y * (1 - distance / GANGWAY_RUN), z: START_Z + distance, facing: 0 };
  }
  return { x: GANGWAY_X + (distance - GANGWAY_RUN), y: 0, z: WALK_Z, facing: Math.PI / 2 };
}

// Everyone walks at the same speed along the same path, so a gap left at the
// top of the gangway lasts the whole way. It is measured along the path, and
// the corner at the gangway's foot can cut the straight-line gap by up to
// the square root of 2, hence the extra.
const BODY_WIDTH = 1.0;
const SET_OFF_GAP = BODY_WIDTH * Math.SQRT2 + 0.1;

// A small pool of walkers, reused so it never grows. step() moves them on;
// justArrived marks one that has just set off, so the drawing can re-dress him.
export function makeCrowd({ count = 2, speed = 0.8, random = Math.random } = {}) {
  const walkers = Array.from({ length: count }, (_, i) => ({ visible: false, distance: 0, wait: 1 + i * 3.2, justArrived: false }));
  const gangwayClear = () => walkers.every((w) => !w.visible || w.distance >= SET_OFF_GAP);
  return {
    walkers,
    step(dt) {
      for (const w of walkers) {
        w.justArrived = false;
        if (!w.visible) {
          w.wait -= dt;
          if (w.wait > 0 || !gangwayClear()) continue;   // waits his turn at the top
          w.visible = true;
          w.distance = 0;
          w.justArrived = true;
        } else {
          w.distance += speed * dt;
          if (w.distance >= PATH_LENGTH) {
            w.visible = false;
            w.wait = 2 + random() * 4;
          }
        }
      }
    },
  };
}
