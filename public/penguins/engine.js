// Shared look for every world: toon materials, ink lines, the floating diorama room, lights,
// camera and orbit. Rules and reasons: docs/ART-DIRECTION.md.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BG = '#3e4b5e';   // slate blue: a cool ground under warm wood and orange, clear of the mint walls
export const INK = '#1f2126';
// Shared colour tokens. A world adds its own on top, never a raw hex for something shared.
export const PALETTE = {
  wall: '#8fb3a8', wallSide: '#7fa396', floor: '#cfa36f', rug: '#8fa3a8', couch: '#c46a5b', couchLight: '#d08577',
  penguin: '#2b2f38', belly: '#f3f1ec', beak: '#e8973f', beakDark: '#c97a2c', tv: '#343845', cabinet: '#8c6448',
  remote: '#9aa3ad', button: '#c95d4f', lamp: '#e6c77a', pole: '#343845', window: '#cfe0e3', blush: '#e89a9a',
  skin: '#e9c197', pants: '#4a5068', pan: '#343845', pancake: '#dcae68', board: '#c46a5b', wheel: '#2b2f38',
  scarf: '#e0b85a', scarf2: '#b85a4a', anger: '#d8433a',
};

// ---------- materials ----------
let toonGradient = null;
function gradient() {
  if (toonGradient) return toonGradient;
  const steps = [0.42, 0.7, 1];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v * 255, v * 255, v * 255, 255], i * 4));
  toonGradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  toonGradient.minFilter = toonGradient.magFilter = THREE.NearestFilter;
  toonGradient.needsUpdate = true;
  return toonGradient;
}
const matCache = new Map();
export function mat(hex) {
  if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshToonMaterial({ color: hex, gradientMap: gradient() }));
  return matCache.get(hex);
}
export const role = (name) => mat(PALETTE[name]);
// A toon material with a painted texture (paving, glazing) that takes the same light steps as mat().
export function mapMat(texture) { return new THREE.MeshToonMaterial({ map: texture, gradientMap: gradient() }); }
export const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });

// Inverted-hull outline: a slightly fattened back-face copy drawn in ink. Same trick drei's <Outlines> uses.
let outlineMat = null;
function addOutline(mesh) {
  outlineMat ??= new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { thickness: { value: 0.028 }, color: { value: new THREE.Color(INK) } },
    vertexShader: `uniform float thickness;
      void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0); }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
  });
  const hull = new THREE.Mesh(toCreasedNormals(mesh.geometry.clone(), Math.PI), outlineMat);
  hull.castShadow = false;
  hull.userData.isHull = true;
  mesh.add(hull);
}

// ---------- geometry helpers ----------
export const box = (w, h, d, r = 0.07) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
export const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

export function part(geo, material, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], outline = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  if (outline) addOutline(m);
  return m;
}

// A two-tone part: the boundary is drawn per pixel from a field that is
// negative inside the region, so it stays a smooth curve and gets a ~2px ink seam on it.
export function regionToonMat(baseHex, regionHex, glsl, extra = null) {
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient() });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uBase: { value: new THREE.Color(baseHex) }, uRegion: { value: new THREE.Color(regionHex) }, uInk: { value: new THREE.Color(INK) },
    }, extra?.uniforms);
    shader.vertexShader = 'varying vec3 vObjPos;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = 'varying vec3 vObjPos;\nuniform vec3 uBase, uRegion, uInk;\n' + (extra?.decl ?? '') + glsl + '\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float f = regionField(vObjPos);
      float aa = fwidth(f);
      vec3 paint = mix(uRegion, uBase, smoothstep(-aa, aa, f)) * shadeMul(vObjPos);
      float seam = 1.0 - smoothstep(aa * 0.8, aa * 2.2, abs(f));
      diffuseColor.rgb = mix(paint, uInk, seam);
      ${extra?.code ?? ''}`);
  };
  m.customProgramCacheKey = () => glsl + (extra?.code ?? '');
  return m;
}
export const NO_SHADE = 'float shadeMul(vec3 p){ return 1.0; }';
export function twoTone(geo, baseHex, regionHex, glsl, shadeGlsl = NO_SHADE, extra = null) {
  return [geo, regionToonMat(baseHex, regionHex, glsl + '\n' + shadeGlsl, extra)];
}

// A flat printed panel (a sign, a board, a plaque) drawn on a canvas. redraw(...args) repaints it.
export function textPlane(w, h, draw, px = 256) {
  const canvas = document.createElement('canvas'); canvas.width = px * w; canvas.height = px * h;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.userData.isScreen = true;   // flat print: no crease lines inside it
  const redraw = (...args) => { draw(canvas.getContext('2d'), canvas.width, canvas.height, ...args); tex.needsUpdate = true; };
  return { mesh, redraw };
}

// ---------- the floating diorama room ----------
export const ROOM = 8.5, WALL_AT = -ROOM / 2 + 0.125;
// Square floor on a darker base, two walls, and a soft shadow far below so it reads as floating.
// A world can pick its size, and shorten the back wall (backFrom..backTo along x) and side wall
// (sideFrom..sideTo along z) when only part of the room is indoors.
export function buildRoom(parent, colors, { size = ROOM, sideFrom = -size / 2, sideTo = size / 2, backFrom = -size / 2, backTo = size / 2 } = {}) {
  const wallAt = -size / 2 + 0.125;
  part(box(size, 0.3, size, 0.05), mat(colors.floor), parent, [0, -0.15, 0]);
  part(box(size - 0.1, 0.55, size - 0.1, 0.05), mat(colors.base), parent, [0, -0.55, 0]);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.47, size * 1.47), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.6;
  shadow.userData.noLines = true;
  parent.add(shadow);
  return {
    wallAt,
    backWall: [part(box(backTo - backFrom, 4.6, 0.25, 0.05), mat(colors.wall), parent, [(backFrom + backTo) / 2, 2.3, wallAt])],
    sideWall: [part(box(0.25, 4.6, sideTo - sideFrom, 0.05), mat(colors.wallSide), parent, [wallAt, 2.3, (sideFrom + sideTo) / 2])],
  };
}

// ---------- renderer, lights, camera, orbit, ink-line pass ----------
// An instanced mesh (many copies in one draw) must place each copy, or every copy's outline lands
// on top of the others at the mesh's own origin.
const normalShader = (mask) => new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; void main(){
    vec4 p = vec4(position, 1.0); vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    vN = normalize(normalMatrix * n); gl_Position = projectionMatrix * modelViewMatrix * p; }`,
  fragmentShader: `varying vec3 vN; void main(){ gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, ${mask ? '0.0' : '1.0'}); }`,
});

export function createEngine(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);

  // Key light high and front-right: both walls face into it, shadows fall short and behind things.
  const sun = new THREE.DirectionalLight('#fff3e0', 2.0);
  sun.position.set(3, 12.5, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2.5;
  scene.add(sun);
  // Fill: cool from the sky, warm bounce off the wooden floor, so shadow sides keep some colour.
  const sky = new THREE.HemisphereLight('#e8f1ff', '#d9b48a', 1.25), ambient = new THREE.AmbientLight('#ffffff', 0.35);
  scene.add(sky, ambient);
  // A world can cut its own power (the factory's short circuit): world.lights() gives `power`, from
  // 1 (fully lit) to 0 (dark), and `emergency`, a red glow from 0 to 1. Worlds without it are fully lit.
  const WHITE = new THREE.Color('#ffffff'), EMERGENCY = new THREE.Color('#ff4a3a');
  function light({ power = 1, emergency = 0 } = {}) {
    sun.intensity = 2.0 * power; sky.intensity = 1.25 * power;
    ambient.intensity = 0.35 + 0.2 * emergency;
    ambient.color.lerpColors(WHITE, EMERGENCY, emergency);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.6;
  controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.3;   // never below the floor
  controls.listenToKeyEvents(window);   // arrow keys orbit too

  let world = null;
  function fitDistance() {
    // Fit a loose box around the room (with margin, so it reads as floating) at any aspect ratio.
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const [hw, hh] = world.fit;
    return Math.max(hh / tanHalf, hw / (tanHalf * camera.aspect));
  }
  function frameCamera(dir) {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    camera.position.copy(world.camTarget).addScaledVector(dir.clone().normalize(), fitDistance());
    camera.lookAt(world.camTarget);
    const d = fitDistance();
    controls.minDistance = d * 0.45; controls.maxDistance = d * 1.25;
    // Draw far enough to reach past the back of the room from the furthest zoom. On a narrow
    // portrait phone the camera stands far back to fit the room's width, and a fixed limit cut off
    // the back of the restaurant and the whole of the hotel.
    camera.far = controls.maxDistance + 30;
    camera.updateProjectionMatrix();
    lines.material.uniforms.far.value = camera.far;
  }

  // The inverted hull only inks silhouettes against what is behind them. Edges where surfaces meet
  // (rug on floor, wall into floor, room corner) need lines too, so a normal+depth buffer is rendered
  // and any sharp change in surface angle or depth is inked on top of the normal frame.
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const normalRT = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y) });
  const normalMat = normalShader(false), screenMaskMat = normalShader(true);
  const lines = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      tNormal: { value: normalRT.texture }, tDepth: { value: normalRT.depthTexture }, res: { value: size.clone() },
      near: { value: camera.near }, far: { value: camera.far }, ink: { value: new THREE.Color(INK) }, px: { value: renderer.getPixelRatio() },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tNormal, tDepth; uniform vec2 res; uniform float near, far, px; uniform vec3 ink;
      varying vec2 vUv;
      float linDepth(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0*near*far / (far + near - z*(far-near)); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec4 n0 = texture2D(tNormal, vUv);
        float d0 = linDepth(vUv), dd = 0.0, nd = 0.0;
        vec2 o = px * 0.9 / res;
        for (int i = 0; i < 4; i++) {
          vec2 k = i == 0 ? vec2(o.x, 0) : i == 1 ? vec2(-o.x, 0) : i == 2 ? vec2(0, o.y) : vec2(0, -o.y);
          dd = max(dd, abs(linDepth(vUv + k) - d0));
          nd = max(nd, distance(texture2D(tNormal, vUv + k).rgb, n0.rgb));
        }
        float edge = max(smoothstep(0.03, 0.06, dd / d0), smoothstep(0.42, 0.6, nd));
        edge *= n0.a;   // nothing inside a screen's picture
        gl_FragColor = vec4(toSRGB(ink), edge * 0.9);
      }`,
  }));
  const lineScene = new THREE.Scene(); lineScene.add(lines);
  const lineCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const drawn = [];   // reused every frame: things spawn and change, so the list is rebuilt each time

  function render() {
    light(world.lights?.());
    // Dollhouse cutaway: a wall between the camera and the room is hidden while you look through it.
    world.walls.backWall.forEach((m) => (m.visible = camera.position.z > world.walls.wallAt + 0.2));
    world.walls.sideWall.forEach((m) => (m.visible = camera.position.x > world.walls.wallAt + 0.2));
    drawn.length = 0;
    scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) drawn.push(o); });
    const saved = drawn.map((m) => [m.material, m.visible]);
    drawn.forEach((m) => {
      if (m.userData.isHull || m.userData.noLines || m.isSprite) { m.visible = false; return; }
      m.material = m.userData.isScreen ? screenMaskMat : normalMat;
    });
    const bg = scene.background; scene.background = null;
    renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 1);
    renderer.setRenderTarget(normalRT); renderer.clear(); renderer.render(scene, camera);
    scene.background = bg; drawn.forEach((m, i) => { m.material = saved[i][0]; m.visible = saved[i][1] && !m.isSprite; });
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    renderer.autoClear = false; renderer.render(lineScene, lineCam);
    // Speech bubbles and other flat symbols (sprites) are drawn last, over the ink lines, or the lines
    // of whatever stands behind a bubble show through it. The scene's depth is kept, so walls still hide them.
    if (drawn.some((m) => m.isSprite)) {
      drawn.forEach((m, i) => { m.visible = m.isSprite === true && saved[i][1]; });   // a mesh's isSprite is undefined, and only false hides
      scene.background = null;
      renderer.render(scene, camera);
      scene.background = bg;
      drawn.forEach((m, i) => { m.visible = saved[i][1]; });
    } else drawn.forEach((m, i) => { m.visible = saved[i][1]; });
    renderer.autoClear = true;
  }

  function setWorld(next) {
    if (world) world.group.visible = false;
    world = next;
    world.group.visible = true;
    // A bigger diorama needs a bigger shadow box, or its far corners lose their shadows.
    const reach = world.shadowReach ?? 7;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach });
    sun.shadow.camera.updateProjectionMatrix();
    controls.target.copy(world.camTarget);
    frameCamera(world.startDir);
    controls.update();
  }

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    if (world) frameCamera(camera.position.clone().sub(world.camTarget));   // a resize can come while the first world is still building
    renderer.getDrawingBufferSize(size);
    normalRT.setSize(size.x, size.y);
    lines.material.uniforms.res.value.copy(size);
  });

  return { renderer, scene, camera, controls, render, setWorld };
}
