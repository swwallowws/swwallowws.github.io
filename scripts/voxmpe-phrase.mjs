// A synthetic sung phrase for the voxmpe studio shot (visuals/manifest.json),
// until a real take replaces it: about nineteen seconds, four short lines in
// an arch (a rising question, a climb to the peak, an echo, a descent home),
// mostly stepwise with a few leaps, tied glides into the long notes, vibrato
// on the held ones, and breaths between lines. Some pitches sit a little off
// the 12-TET grid on purpose.
//   node scripts/voxmpe-phrase.mjs   (writes visuals/staging/voxmpe-phrase.wav)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SR = 44100;
const PACE = 1.4; // every duration below is stretched by this

// Cents from A4.
const D4 = -700, F4 = -400, G4 = -200, A4 = 0, C5 = 300, D5 = 500, E5 = 690, F5 = 785;

// [seconds, cents at the start, cents at the end, vibrato 0..1, tied?];
// null cents is a breath. A tied entry glides into the next one without a
// new attack. A short breath first and none after the last note, so the roll
// is filled edge to edge and the first note clears the pitch labels.
const PHRASE = [
  [0.25, null, null, 0],
  // A rising question.
  [0.5, D4, D4, 0],
  [0.4, F4, F4, 0],
  [0.54, G4, G4, 0, true],
  [0.08, G4, A4, 0, true],
  [0.9, A4, A4, 0.8],
  [0.28, null, null, 0],
  // The climb to the peak.
  [0.35, A4, A4, 0],
  [0.4, C5, C5, 0],
  [0.53, D5, D5, 0, true],
  [0.1, D5, F5, 0, true],
  [1.1, F5, F5, 1, true],
  [0.07, F5, E5, 0, true],
  [0.4, E5, E5, 0],
  [0.55, D5, D5, 0.4],
  [0.32, null, null, 0],
  // An echo that turns around.
  [0.35, C5, C5, 0],
  [0.35, D5, D5, 0],
  [0.3, C5, C5, 0],
  [0.45, A4, A4, 0.5],
  [0.47, G4, G4, 0, true],
  [0.08, G4, A4, 0, true],
  [0.8, A4, A4, 0.8],
  [0.35, null, null, 0],
  // The descent home.
  [0.4, F4, F4, 0],
  [0.35, G4, G4, 0],
  [0.35, A4, A4, 0],
  [0.3, G4, G4, 0],
  [0.58, F4, F4, 0, true],
  [0.12, F4, D4, 0, true],
  [1.6, D4, D4, 1],
].map(([d, ...rest]) => [d * PACE, ...rest]);

function render() {
  const total = PHRASE.reduce((s, [d]) => s + d, 0) + 0.08;
  const out = new Float32Array(Math.round(total * SR));
  let i = 0;
  let phase = 0;
  let prevTied = false;
  for (const [dur, from, to, vib, tied = false] of PHRASE) {
    const n = Math.round(dur * SR);
    const attack = !prevTied;
    prevTied = tied && from !== null;
    for (let k = 0; k < n; k++, i++) {
      if (from === null) continue;
      const u = k / n;
      const t = k / SR;
      // A soft attack and release, except across a tie, where the voice glides on.
      const env = (attack ? Math.min(1, t / 0.03) : 1) * (tied ? 1 : Math.min(1, (n - k) / (0.04 * SR)));
      // Glides ease in and out, as a voice sliding between notes does.
      const ease = u * u * (3 - 2 * u);
      const c = from + (to - from) * ease + vib * 22 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.25);
      const hz = 440 * 2 ** (c / 1200);
      phase += (2 * Math.PI * hz) / SR;
      out[i] = 0.3 * env * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase));
    }
  }
  return out;
}

function wav16(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, k) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + k * 2));
  return buf;
}

const dir = join(root, "visuals/staging");
mkdirSync(dir, { recursive: true });
const file = join(dir, "voxmpe-phrase.wav");
writeFileSync(file, wav16(render()));
console.log(file);
