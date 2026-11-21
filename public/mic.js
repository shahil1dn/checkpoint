// Records one clip while the player holds the talk key. Clips stay in memory.
// webm/opus is first because it is the format proven against Voxtral (S2).
const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
const MIN_CLIP_MS = 300;
const MAX_CLIP_MS = 15_000;

let stream = null;
let active = null;

// Asked once, from a click, so holding Space later starts recording at once.
export async function prepareMic() {
  stream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
}

export const micReady = () => stream !== null;
export const recording = () => active !== null;

export function startClip() {
  if (!stream || active) return false;
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  recorder.start();
  active = { recorder, done, startedAt: performance.now(), timer: setTimeout(() => recorder.stop(), MAX_CLIP_MS) };
  return true;
}

// Returns the clip, or null when nothing was recording or the press was a tap.
export async function endClip() {
  if (!active) return null;
  const { recorder, done, startedAt, timer } = active;
  active = null;
  clearTimeout(timer);
  const heldMs = performance.now() - startedAt;
  if (recorder.state !== 'inactive') recorder.stop();
  const clip = await done;
  return heldMs < MIN_CLIP_MS || clip.size === 0 ? null : clip;
}
