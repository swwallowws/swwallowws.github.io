# The lamp: showcase visuals made of strings, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every project's studio screenshot and loop on the showcase with a live card drawn in strings (the lamp), on the welcome page, the project pages and the share cards, and move the old screenshots and loops into each project's repo.

**Architecture:** A small canvas 2D engine (`src/lamp/engine.ts`) draws a card from a card definition: strings with a rest form and a taut form, a lamp under the pointer that blends them, a click that plays a synthesised sound (`src/lamp/sound.ts`) and sweeps a playhead. One definition per project in `src/lamp/cards/`, ported from the approved prototype. Pure helpers live in `src/lamp/core.ts` with no imports, so Node can unit-test them. A dev-only gallery page (`lamp-gallery.html`, not in the build) mounts the cards for `scripts/lamp-check.mjs`, which checks them in a real Chrome, and for the share-card captures.

**Tech Stack:** TypeScript, Vite (multi-page), canvas 2D, Web Audio, Playwright (playwright-core with the system Chrome), Node's built-in test runner with type stripping.

**Spec:** `docs/superpowers/specs/2026-10-05-lamp-visuals-design.md`. Read it before starting. The approved prototype is in `.peek/brainstorm/` (gitignored); Task 0 commits a copy to `docs/superpowers/prototypes/lamp/`, and every task refers to that copy.

## Global Constraints

- Never use an em dash anywhere: code, comments, UI copy, labels, commit messages, docs. Use a hyphen, a colon, a comma, or two sentences.
- Avoid the "not X, Y" contrast construction in copy and comments.
- Strings are the only material on a card: no drawn dots, outlines, knobs, buttons or controls. Shapes come from strings fanning, gathering or straightening.
- Text on a card lives only in the lamp's label or the playhead's label. Text that is part of the music (lyrics, chord symbols, hashtags) may sit on the strings and moves with them.
- Colours come only from the design tokens (`--ground`, `--ground-2`, `--ink`, `--ink-mut`, `--line`, `--acc`, `--drum-kick`, `--drum-snare`, `--drum-hats`, `--drum-perc`), resolved with `cssColor` from `vendor/design/tokens.js`, so Paper and Night both work.
- Lamp radius: `Math.min(180, width * 0.34)` px.
- The Session Notes verse, exactly: `low sun, high tide` / `swallow whole the off-key hums` / `then slowly fade from sight`.
- Commands follow `../permissions.md`: one plain command per Bash call (no `cd ... &&`, no `;`, no pipes, no heredocs, no `$(...)`), file tools over cat/sed, `git -C <path>` for other repos. All commands below run from the showcase repo root.
- Commits: one `git commit` with one `-m` per paragraph, the last paragraph `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work happens on the `lamp-visuals` branch. Never push, in any repo, unless Bengisu asks in that moment.
- CI runs Node 22 (`.github/workflows/pages.yml`); local Node is 24. The test command must work on both.

## Review Focus

The inputs and conditions most likely to bite a visitor that no single card's tests exercise, each pinned by a check in Task 3's `scripts/lamp-check.mjs`:

1. **No sound available** (Web Audio missing, blocked or failing): a click still plays the picture, silently, with no script error.
2. **Many fast clicks**: the card keeps playing, restarts its sweep, and throws nothing.
3. **Reduced motion**: every card holds completely still (no wander, sway, turning hand or sweep) and shows its taut form.
4. **Theme switched while cards are running**: colours follow Night or Paper without a reload.
5. **A phone** (390 px wide, touch): nothing scrolls sideways, and vertical swipes over a card still scroll the page (`touch-action: pan-y`).

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/superpowers/prototypes/lamp/**` | The approved prototype, committed as the reference for porting (Task 0). |
| `src/lamp/core.ts` | Pure helpers, no imports: clamp, easing, colour parsing and mixing, note names, pitch to Hz, lamp radius and weight, play timing. |
| `test/lamp-core.test.ts` | Unit tests for `core.ts` (Node's test runner). |
| `src/lamp/sound.ts` | The shared AudioContext (lazy, safe when unavailable), `tone()` and `hit()`. |
| `src/lamp/engine.ts` | `CardDef` and `CardState` types, `mountCard()`, the draw loop, the lamp, labels, play, pointer, keyboard, theme, reduced motion. |
| `src/lamp/cards/*.ts` | One card per project. |
| `src/lamp/cards/index.ts` | `LAMP_CARDS`: project id to card. |
| `src/lamp/gallery.ts`, `lamp-gallery.html` | Dev-only page mounting the cards (all, or one with `?card=`, a still with `&still=1`, a theme with `&theme=`). |
| `scripts/lamp-check.mjs` | Checks the cards in Chrome; screenshots to `.peek/lamp/`. |
| `src/ui/home.ts`, `src/styles/app.css` | Welcome page: the card replaces the screenshot; the cue button becomes the link. |
| `src/ui/project.ts`, `src/styles/app.css` | Project pages: the card between the head and the rest. |
| `visuals/manifest.json`, `scripts/visuals.mjs`, `scripts/loops.mjs`, `src/data/projects.ts` | Share cards from lamp stills; loops and studio stills retired from the site. |
| Other repos' `media/` and `README.md` | The retired loops and stills, for sharing. |

---

### Task 0: Commit the prototype as the porting reference

**Files:**
- Create: `docs/superpowers/prototypes/lamp/lamp.js`, `docs/superpowers/prototypes/lamp/all-lamp.html`, `docs/superpowers/prototypes/lamp/cards/{starling,coming-undone,rearranged,ready-set,ysad,session-notes,tagline}.js`

**Interfaces:**
- Produces: the reference files every porting task reads.

- [ ] **Step 1: Make the folder**

Run: `mkdir -p docs/superpowers/prototypes/lamp/cards`

- [ ] **Step 2: Copy the engine and the page** (one command each)

Run: `cp .peek/brainstorm/lamp.js docs/superpowers/prototypes/lamp/lamp.js`
Run: `cp .peek/brainstorm/all-lamp.html docs/superpowers/prototypes/lamp/all-lamp.html`

- [ ] **Step 3: Copy the seven cards** (one command each)

Run: `cp .peek/brainstorm/cards/starling.js docs/superpowers/prototypes/lamp/cards/starling.js`
Run: `cp .peek/brainstorm/cards/coming-undone.js docs/superpowers/prototypes/lamp/cards/coming-undone.js`
Run: `cp .peek/brainstorm/cards/rearranged.js docs/superpowers/prototypes/lamp/cards/rearranged.js`
Run: `cp .peek/brainstorm/cards/ready-set.js docs/superpowers/prototypes/lamp/cards/ready-set.js`
Run: `cp .peek/brainstorm/cards/ysad.js docs/superpowers/prototypes/lamp/cards/ysad.js`
Run: `cp .peek/brainstorm/cards/session-notes.js docs/superpowers/prototypes/lamp/cards/session-notes.js`
Run: `cp .peek/brainstorm/cards/tagline.js docs/superpowers/prototypes/lamp/cards/tagline.js`

- [ ] **Step 4: Point the page at the tokens from its new place**

In `docs/superpowers/prototypes/lamp/all-lamp.html`, replace
`<link rel="stylesheet" href="../../public/demos/ysad/vendor/design/tokens.css">`
with
`<link rel="stylesheet" href="../../../../vendor/design/tokens.css">`

- [ ] **Step 5: Check it still opens**

Run: `npm run peek -- "file:///Users/tokamak/Playground/showcase/docs/superpowers/prototypes/lamp/all-lamp.html"`
Expected: four screenshot paths printed; open the desktop Paper one and see seven cards drawn in strings.

- [ ] **Step 6: Commit**

```
git add docs/superpowers/prototypes/lamp
git commit -m "Keep the approved lamp prototype as the reference for porting" -m "The engine (lamp.js), the seven cards and the page, as approved in the browser, so the port has a fixed source." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Pure helpers, with tests

**Files:**
- Create: `src/lamp/core.ts`
- Create: `test/lamp-core.test.ts`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/pages.yml` (run the tests)

**Interfaces:**
- Produces (all exported from `src/lamp/core.ts`):
  - `type Rgb = [number, number, number]`
  - `clamp(v: number, lo: number, hi: number): number`
  - `smooth(x: number): number` (smoothstep on 0..1)
  - `parseRgb(css: string): Rgb`, `mixRgb(a: Rgb, b: Rgb, w: number): Rgb`, `rgba(c: Rgb, alpha: number): string`
  - `nameOf(midi: number): string` (60 -> `C4`), `hz(midi: number): number`
  - `lampRadius(width: number): number`, `lampWeight(dx: number, dy: number, r: number): number`
  - `interface PlayState { p: number; playing: boolean; sweep: number; keep: number }`
  - `playState(ms: number, start: number, durMs: number, relaxMs?: number): PlayState`
  - `behind(when: number, sweep: number, keep: number): number`

- [ ] **Step 1: Write the failing tests**

Create `test/lamp-core.test.ts`:

```ts
// Unit tests for the lamp's pure helpers (src/lamp/core.ts). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  behind, clamp, hz, lampRadius, lampWeight, mixRgb, nameOf, parseRgb, playState, rgba, smooth,
} from '../src/lamp/core.ts';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

test('clamp and smooth hold their ends', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(1), 1);
  assert.equal(smooth(0.5), 0.5);
});

test('the lamp is 180 px at most, and a third of a narrow card', () => {
  assert.equal(lampRadius(1200), 180);
  assert.ok(near(lampRadius(300), 102));
});

test('the lamp is full at its centre and gone at its edge', () => {
  assert.equal(lampWeight(0, 0, 100), 1);
  assert.equal(lampWeight(100, 0, 100), 0);
  assert.equal(lampWeight(0, 250, 100), 0);
  assert.equal(lampWeight(50, 0, 100), 0.5);
});

test('before any click nothing plays', () => {
  assert.deepEqual(playState(5000, -1, 3200), { p: -1, playing: false, sweep: -1, keep: 1 });
});

test('a click scheduled ahead has not started yet', () => {
  const s = playState(900, 1000, 3200);
  assert.equal(s.playing, false);
  assert.equal(s.sweep, -1);
});

test('halfway through, the reveal reaches halfway', () => {
  const s = playState(1000 + 1600, 1000, 3200);
  assert.equal(s.playing, true);
  assert.equal(s.sweep, 0.5);
  assert.equal(s.keep, 1);
});

test('after the end it holds, relaxes, then lets go', () => {
  const end = 1000 + 3200;
  const a = playState(end + 1, 1000, 3200, 1200);
  assert.equal(a.playing, false);
  assert.equal(a.sweep, 1);
  assert.ok(a.keep > 0.99);
  assert.equal(playState(end + 600, 1000, 3200, 1200).keep, 0.5);
  assert.equal(playState(end + 1200, 1000, 3200, 1200).sweep, -1);
});

test('a new click starts the sweep over', () => {
  const s = playState(5010, 5000, 3200);
  assert.equal(s.playing, true);
  assert.ok(s.sweep < 0.01);
});

test('behind the playhead strings turn, ahead they wait', () => {
  assert.equal(behind(0.6, 0.5, 1), 0);
  assert.equal(behind(0.4, 0.5, 1), 1);
  assert.ok(near(behind(0.48, 0.5, 1), 0.5));
  assert.equal(behind(0.4, 0.5, 0.5), 0.5);
  assert.equal(behind(0.1, -1, 1), 0);
});

test('note names and pitches', () => {
  assert.equal(nameOf(60), 'C4');
  assert.equal(nameOf(61), 'C#4');
  assert.equal(nameOf(57), 'A3');
  assert.equal(hz(69), 440);
});

test('colours parse from the browser and mix', () => {
  assert.deepEqual(parseRgb('rgb(12, 34, 56)'), [12, 34, 56]);
  assert.deepEqual(parseRgb('rgba(1, 2, 3, 0.5)'), [1, 2, 3]);
  assert.deepEqual(parseRgb(''), [0, 0, 0]);
  assert.deepEqual(mixRgb([0, 0, 0], [100, 200, 50], 0.5), [50, 100, 25]);
  assert.equal(rgba([1, 2, 3], 0.5), 'rgba(1, 2, 3, 0.5)');
});
```

- [ ] **Step 2: Add the test script**

In `package.json` `"scripts"`, after `"check": "tsc --noEmit",` add:

```json
    "test": "node --experimental-strip-types --test test/*.test.ts",
    "check:lamp": "node scripts/lamp-check.mjs",
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL, with an error that `../src/lamp/core.ts` cannot be found.

- [ ] **Step 4: Write the helpers**

Create `src/lamp/core.ts`:

```ts
/* Pure helpers for the lamp cards: no DOM and no imports, so `npm test` runs
   them in Node directly (test/lamp-core.test.ts). */

export type Rgb = [number, number, number];

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Smoothstep on 0..1: eases in and out, flat at both ends. */
export const smooth = (x: number): number => x * x * (3 - 2 * x);

/** A colour as the browser reports it ("rgb(r, g, b)" or "rgba(...)"). */
export function parseRgb(css: string): Rgb {
  const m = css.match(/[\d.]+/g) ?? [];
  return [Number(m[0] ?? 0), Number(m[1] ?? 0), Number(m[2] ?? 0)];
}

export const mixRgb = (a: Rgb, b: Rgb, w: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * w),
  Math.round(a[1] + (b[1] - a[1]) * w),
  Math.round(a[2] + (b[2] - a[2]) * w),
];

export const rgba = (c: Rgb, alpha: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** A MIDI note's name: 60 is C4. */
export const nameOf = (midi: number): string => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** The lamp's radius on a card this wide: 180 px, at most a third of the card. */
export const lampRadius = (width: number): number => Math.min(180, width * 0.34);
/** How strongly the lamp, centred `dx, dy` away, pulls a point taut: 1 at its centre, 0 at its edge. */
export const lampWeight = (dx: number, dy: number, r: number): number => smooth(clamp(1 - Math.hypot(dx, dy) / r, 0, 1));

/** Where a click's play is at time `ms`. `start` is when it began (-1: never).
    p: progress 0..1 while playing; sweep: how far the reveal reaches (-1 none);
    keep: how firmly the reveal holds, easing from 1 to 0 over `relaxMs` after the end. */
export interface PlayState { p: number; playing: boolean; sweep: number; keep: number }
export function playState(ms: number, start: number, durMs: number, relaxMs = 1200): PlayState {
  if (start < 0) return { p: -1, playing: false, sweep: -1, keep: 1 };
  const p = (ms - start) / durMs;
  const end = start + durMs;
  const relax = ms > end ? clamp((ms - end) / relaxMs, 0, 1) : 0;
  const sweep = ms >= start && relax < 1 ? clamp(p, 0, 1) : -1;
  return { p, playing: p >= 0 && p <= 1, sweep, keep: 1 - smooth(relax) };
}

/** How taut the playhead holds a point it reaches at `when`: 0 ahead of it, easing to `keep` just behind it. */
export const behind = (when: number, sweep: number, keep: number): number =>
  sweep >= 0 && when <= sweep ? smooth(clamp((sweep - when) / 0.04, 0, 1)) * keep : 0;
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 7: Run the tests in CI**

In `.github/workflows/pages.yml`, after `- run: npm ci` add:

```yaml
      - run: npm test
```

- [ ] **Step 8: Commit**

```
git add src/lamp/core.ts test/lamp-core.test.ts package.json .github/workflows/pages.yml
git commit -m "Add the lamp's pure helpers, with tests" -m "Easing, colours, note names, the lamp's size and weight, and play timing, kept free of the DOM so npm test runs them in Node. CI runs the tests before building." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Sound

**Files:**
- Create: `src/lamp/sound.ts`

**Interfaces:**
- Consumes: `hz` from `src/lamp/core.ts`.
- Produces:
  - `type Drum = 'kick' | 'snare' | 'hats' | 'perc'`
  - `audio(): AudioContext | null` (lazily made; `null` when Web Audio is missing or fails, and from then on)
  - `tone(a: AudioContext, midi: number, at: number, dur: number, gain?: number, type?: OscillatorType, bendTo?: number | null): void`
  - `hit(a: AudioContext, kind: Drum, at: number, gain?: number): void`

The no-sound case is checked in a real browser in Task 3 (`scripts/lamp-check.mjs`, "No sound").

- [ ] **Step 1: Write the module**

Create `src/lamp/sound.ts`:

```ts
/* Sound for the lamp cards, synthesised in the page: no files to fetch. Audio
   starts only from a click or a key, as browsers require. Where the browser has
   no Web Audio or refuses it, audio() returns null and the cards play silently. */

import { hz } from './core.js';

export type Drum = 'kick' | 'snare' | 'hats' | 'perc';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let broken = false;

export function audio(): AudioContext | null {
  if (broken) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch {
    broken = true;
    return null;
  }
}

/** A note: `midi` at `at` seconds (the context's clock) for `dur` seconds, optionally bending to `bendTo`. */
export function tone(
  a: AudioContext, midi: number, at: number, dur: number,
  gain = 0.1, type: OscillatorType = 'triangle', bendTo: number | null = null,
): void {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(hz(midi), at);
  if (bendTo != null) o.frequency.linearRampToValueAtTime(hz(bendTo), at + Math.min(0.25, dur * 0.5));
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** A drum hit: a falling sine for the kick, filtered noise for the rest. */
export function hit(a: AudioContext, kind: Drum, at: number, gain = 1): void {
  const g = a.createGain();
  if (kind === 'kick') {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(130, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    g.gain.setValueAtTime(0.5 * gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 0.32);
    return;
  }
  if (!noise) return;
  const n = a.createBufferSource(), f = a.createBiquadFilter();
  n.buffer = noise;
  f.type = kind === 'hats' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hats' ? 7000 : kind === 'snare' ? 1800 : 900;
  const len = kind === 'hats' ? 0.05 : kind === 'snare' ? 0.18 : 0.1;
  g.gain.setValueAtTime((kind === 'hats' ? 0.12 : 0.3) * gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  n.connect(f).connect(g).connect(a.destination);
  n.start(at);
  n.stop(at + len + 0.02);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/lamp/sound.ts
git commit -m "Add the lamp's sound: tones and drum hits, synthesised" -m "One shared AudioContext, made on the first click; where Web Audio is missing or fails the cards play silently." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The engine, the gallery, the browser check, and the first card (Starling)

**Files:**
- Create: `src/lamp/engine.ts`
- Create: `src/lamp/cards/starling.ts`
- Create: `src/lamp/cards/index.ts`
- Create: `src/lamp/gallery.ts`, `lamp-gallery.html`
- Create: `scripts/lamp-check.mjs`

**Interfaces:**
- Consumes: `core.ts` (Task 1), `sound.ts` (Task 2), `cssColor(name: string, el?: Element): string` from `vendor/design/tokens.js`.
- Produces (from `src/lamp/engine.ts`):
  - `type ColourKey = 'ground' | 'ground2' | 'ink' | 'mut' | 'line' | 'acc' | 'kick' | 'snare' | 'hats' | 'perc'`
  - `type Point = [number, number]`
  - `interface CardState` and `interface CardDef` (below)
  - `mountCard(host: HTMLElement, def: CardDef, opts: { label: string; still?: boolean }): { destroy(): void }`
  - `calm(): boolean` (reduced motion), `mono(c: CanvasRenderingContext2D, px: number): void`
  - On the host element: `data-category`, `data-label` (what the lamp names now, or empty), `data-playing` (`'1'` or `'0'`), `data-ready` (`'1'` after the first draw).
- Produces (from `src/lamp/cards/index.ts`): `LAMP_CARDS: Record<string, CardDef>`, keyed by project id (`voxmpe`, `stemscribe`, `rearranged`, `tabridge`, `ysad`, `session-notes`, `intentional`).

- [ ] **Step 1: Write the browser check first**

Create `scripts/lamp-check.mjs`:

```js
// Checks the lamp cards in a real Chrome (spec: docs/superpowers/specs/
// 2026-10-05-lamp-visuals-design.md). Every card draws without script errors,
// names what the lamp is over, and plays; and the cards survive what visitors
// bring: no sound, many clicks, reduced motion, a theme switch, a phone.
// Screenshots go to .peek/lamp/ for a look by eye.
//   npm run dev -- --port 4317 --strictPort      (in another terminal)
//   npm run check:lamp -- http://localhost:4317/
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const base = new URL(process.argv[2] ?? "http://localhost:4317/");
const out = join(process.cwd(), ".peek", "lamp");
mkdirSync(out, { recursive: true });

// Where to hold the lamp (fractions of the card) and what its label must say there.
const EXPECT = {
  voxmpe: [[0.5, 0.5, /^([A-G]#?\d|slide )/]],
  stemscribe: [[0.5, 0.15, /^vocals · written as notes$/], [0.5, 0.83, /^drums · written as notes$/]],
  rearranged: [[0.5, 0.2, /^before/], [0.5, 0.8, /^after · /]],
  tabridge: [[0.5, 0.24, /^your part · /], [0.5, 0.86, /^drums$/]],
  ysad: [[0.5, 0.09, /^hats/]],
  "session-notes": [[0.2, 0.23, /^\[1\] · a clip on bar 1$/]],
  intentional: [[0.5, 0.5, /(kept|dropped)/]],
};

const problems = [];
const gallery = (q) => new URL(`lamp-gallery.html?${q}`, base).toString();
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(q, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  page.on("pageerror", (e) => problems.push(`${q || "all"}: script error: ${e.message}`));
  await page.goto(gallery(q), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}
async function holdAt(page, sel, fx, fy) {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 6 });
  await page.waitForTimeout(700);
}
const data = (page, id, key) => page.locator(`#${id}`).evaluate((el, k) => el.dataset[k] ?? "", key);
const pixel = (page, id) =>
  page.locator(`#${id} canvas`).evaluate((c) => [...c.getContext("2d").getImageData(3, 3, 1, 1).data]);

try {
  // Which cards exist so far; every one must have expectations above.
  const index = await open("");
  const ids = await index.locator(".lamp-host").evaluateAll((els) => els.map((e) => e.id));
  await index.close();
  if (!ids.length) problems.push("the gallery shows no cards");
  for (const id of ids) if (!EXPECT[id]) problems.push(`${id}: no expectations in scripts/lamp-check.mjs`);

  for (const theme of ["paper", "night"]) {
    for (const id of ids) {
      const page = await open(`card=${id}&theme=${theme}`);
      const sel = `#${id} canvas`;
      await page.locator(sel).screenshot({ path: join(out, `${id}-${theme}-rest.png`) });
      for (const [fx, fy, want] of EXPECT[id] ?? []) {
        await holdAt(page, sel, fx, fy);
        const label = await data(page, id, "label");
        if (!want.test(label)) problems.push(`${id} (${theme}): at ${fx}, ${fy} the lamp says "${label}", expected ${want}`);
        if (label.includes(String.fromCharCode(0x2014))) problems.push(`${id}: an em dash in a label`);
      }
      await page.locator(sel).screenshot({ path: join(out, `${id}-${theme}-lamp.png`) });
      await page.locator(sel).click();
      await page.waitForTimeout(1500);
      if ((await data(page, id, "playing")) !== "1") problems.push(`${id} (${theme}): not playing 1.5 s after a click`);
      await page.locator(sel).screenshot({ path: join(out, `${id}-${theme}-play.png`) });
      await page.close();
    }
  }

  // No sound: without Web Audio a click still plays the picture, silently.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (e) => problems.push(`no sound: script error: ${e.message}`));
    await page.addInitScript(() => {
      window.AudioContext = class { constructor() { throw new Error("no Web Audio here"); } };
    });
    await page.goto(gallery(""), { waitUntil: "networkidle" });
    for (const id of ids) {
      await page.locator(`#${id} canvas`).click();
      await page.waitForTimeout(400);
      if ((await data(page, id, "playing")) !== "1") problems.push(`no sound: ${id} did not play its picture`);
    }
    await page.close();
  }

  // Many clicks: a restless visitor clicks fast; the card keeps playing.
  {
    const page = await open("");
    const id = ids[0];
    for (let i = 0; i < 6; i++) {
      await page.locator(`#${id} canvas`).click();
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    if ((await data(page, id, "playing")) !== "1") problems.push(`many clicks: ${id} stopped playing`);
    await page.close();
  }

  // Reduced motion: every card holds still (two frames 600 ms apart are the same).
  {
    const page = await open("", { reducedMotion: "reduce" });
    for (const id of ids) {
      const grab = () => page.locator(`#${id} canvas`).evaluate((c) => c.toDataURL());
      const a = await grab();
      await page.waitForTimeout(600);
      const b = await grab();
      if (a !== b) problems.push(`reduced motion: ${id} still moves`);
    }
    await page.close();
  }

  // Theme switch: colours follow without a reload.
  {
    const page = await open(`card=${ids[0]}&theme=paper`);
    const before = await pixel(page, ids[0]);
    await page.evaluate(() => { document.documentElement.dataset.theme = "night"; });
    await page.waitForTimeout(300);
    const after = await pixel(page, ids[0]);
    if (before.join() === after.join()) problems.push(`theme switch: ${ids[0]} kept its Paper colours in Night`);
    await page.close();
  }

  // A phone: nothing wider than the screen, and vertical swipes still scroll.
  {
    const page = await open("", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push("phone: the page scrolls sideways");
    const touch = await page.locator(".lamp-host canvas").evaluateAll((cs) => cs.map((c) => getComputedStyle(c).touchAction));
    if (touch.some((t) => t !== "pan-y")) problems.push(`phone: touch-action is ${touch.join(", ")}, expected pan-y`);
    for (const id of ids) await page.locator(`#${id} canvas`).screenshot({ path: join(out, `${id}-phone.png`) });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`checked ${base}: screenshots in .peek/lamp/`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${[...new Set(problems)].join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("no problems");
}
```

- [ ] **Step 2: Write the gallery page**

Create `lamp-gallery.html` at the repo root (served by `npm run dev` only; it is not in `vite.config.ts`'s inputs, so it never ships):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Lamp cards (dev)</title>
    <style>
      body { margin: 0; background: var(--ground); color: var(--ink); }
      #grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(440px, 100%), 1fr)); gap: 24px; padding: 24px 16px; max-width: 1240px; margin: 0 auto; box-sizing: border-box; }
      .lamp-host { height: 320px; border: var(--hairline); background: var(--ground-2); }
      body.still #grid { display: block; padding: 0; max-width: none; }
      body.still .lamp-host { width: 100vw; height: 100vh; border: 0; }
    </style>
  </head>
  <body>
    <div id="grid"></div>
    <script type="module" src="/src/lamp/gallery.ts"></script>
  </body>
</html>
```

Create `src/lamp/gallery.ts`:

```ts
/* The dev-only gallery (lamp-gallery.html): every lamp card, or one with
   ?card=<project id>; &still=1 fills the window with a still for the share
   cards; &theme=paper|night forces a mode. Used by scripts/lamp-check.mjs and
   the share-card captures in visuals/manifest.json. */

import '../../vendor/design/tokens.css';
import { mountCard } from './engine.js';
import { LAMP_CARDS } from './cards/index.js';

const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme === 'paper' || theme === 'night') document.documentElement.dataset['theme'] = theme;
const only = q.get('card');
const still = q.has('still');
if (still) document.body.classList.add('still');

const grid = document.getElementById('grid');
if (!grid) throw new Error('#grid is missing');
for (const [id, def] of Object.entries(LAMP_CARDS)) {
  if (only && id !== only) continue;
  const host = document.createElement('div');
  host.id = id;
  grid.append(host);
  mountCard(host, def, { label: id, still });
}
```

- [ ] **Step 3: Write the engine**

Create `src/lamp/engine.ts` (ported from `docs/superpowers/prototypes/lamp/lamp.js`; behaviour as approved, plus keyboard, reduced motion, still captures and the host's data attributes):

```ts
/* The lamp: draws one project's card in strings, on a canvas.
   A card is a bundle of strings with a rest form (the music as a musician
   knows it) and a taut form (what the tool makes of it). The lamp, a soft light
   under the pointer, pulls the strings it touches taut and shows the card's
   backdrop beneath it; a click (or Enter, or Space) plays the card, and
   everything the playhead passes turns taut, then relaxes. Text lives only in
   the lamp's label or rides with the playhead.
   Spec: docs/superpowers/specs/2026-10-05-lamp-visuals-design.md */

import { cssColor } from '../../vendor/design/tokens.js';
import { behind, clamp, lampRadius, lampWeight, mixRgb, parseRgb, playState, rgba, type Rgb } from './core.js';
import { audio } from './sound.js';

export type ColourKey = 'ground' | 'ground2' | 'ink' | 'mut' | 'line' | 'acc' | 'kick' | 'snare' | 'hats' | 'perc';
export type Point = [number, number];

const TOKENS: Record<ColourKey, string> = {
  ground: '--ground', ground2: '--ground-2', ink: '--ink', mut: '--ink-mut', line: '--line', acc: '--acc',
  kick: '--drum-kick', snare: '--drum-snare', hats: '--drum-hats', perc: '--drum-perc',
};

/** What a card's functions see each frame. Positions are in px within the card. */
export interface CardState {
  readonly el: HTMLElement;
  W: number;
  H: number;
  /** The pointer, and whether it is over the card. */
  x: number;
  y: number;
  inside: boolean;
  /** The lamp's centre: it eases toward the pointer, or wanders when idle. */
  lx: number;
  ly: number;
  /** Seconds: 0 under reduced motion, 1 in a still. */
  sec: number;
  /** The click's play (see core.ts playState). */
  p: number;
  playing: boolean;
  sweep: number;
  keep: number;
  C: Record<ColourKey, Rgb>;
  /** Differs per card, so idle lamps don't wander in step. */
  seed: number;
  /** A card's own note about the last click (Rearranged: which row). */
  row?: string;
  /** Fractions of the drawing area (inside a 22 px margin) to px, and back. */
  U(u: number): number;
  V(v: number): number;
  u(x: number): number;
  /** How strongly the lamp pulls the point (x, y) taut, 0..1 (1 everywhere under reduced motion). */
  wAt(x: number, y: number): number;
  /** As wAt, or the playhead's hold for a point it reaches at `when`. */
  lit(x: number, y: number, when: number): number;
}

/** One project's card. `rest` and `tight` give string k's point at t (0..1 along the string). */
export interface CardDef {
  id: string;
  category: 'transcribe' | 'transform' | 'perceive' | 'workflow';
  strings: number;
  points?: number;
  /** Seconds a click plays. Default 3.2. */
  dur?: number;
  /** How much thicker a fully taut string gets. Default 0.4. */
  thick?: number;
  /** Where the lamp sits in a still capture, as fractions of the card. Default the centre. */
  still?: Point;
  rest(s: CardState, k: number, t: number, sec: number): Point;
  tight(s: CardState, k: number, t: number, sec: number): Point;
  /** When the playhead reaches string k's point t (0..1). Default t. */
  when?(k: number, t: number): number;
  /** A card's own pull toward taut, besides the lamp and the playhead (YSAD's hand). */
  lift?(s: CardState, k: number, t: number): number;
  /** How intensely a piece shows (colour and thickness), given how taut it is. Default w. */
  intensity?(s: CardState, k: number, t: number, w: number): number;
  colour?(k: number): ColourKey;
  /** A string's opacity at rest. Default 0.7 for the middle string, 0.3 for the rest. */
  base?(k: number): number;
  wander?(s: CardState, sec: number): Point;
  /** What lies beneath, shown through the lamp and behind the playhead. */
  backdrop?(s: CardState, o: CanvasRenderingContext2D): void;
  /** Drawn under the strings, always (lyrics). */
  surface?(s: CardState, ctx: CanvasRenderingContext2D, sec: number): void;
  /** Drawn over the strings, always (chord symbols, hashtags, YSAD's hand). */
  over?(s: CardState, ctx: CanvasRenderingContext2D, sec: number): void;
  sweepMask?(s: CardState, o: CanvasRenderingContext2D, p: number): void;
  sweepX?(s: CardState, p: number): number;
  playhead?(s: CardState, ctx: CanvasRenderingContext2D, p: number): void;
  label?(s: CardState, x: number, y: number): string | null;
  playLabel?(s: CardState, p: number): { text: string; x: number; y: number } | null;
  /** Runs on every click, before the sound (and when there is no sound). */
  onPlay?(s: CardState): void;
  audio?(a: AudioContext, at: number, s: CardState): void;
}

const POINTS = 160, LEVELS = 8, PAD = 22, RELAX_MS = 1200, IDLE_MS = 2500;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
/** Whether the reader asked for reduced motion: then cards draw still and taut. */
export const calm = (): boolean => motionQuery.matches;

/** Sets a canvas font to the design system's mono at `px`. */
export const mono = (c: CanvasRenderingContext2D, px: number): void => {
  c.font = `${px}px "JetBrains Mono", monospace`;
};

interface Mounted {
  s: CardState;
  def: CardDef;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  off: HTMLCanvasElement;
  octx: CanvasRenderingContext2D;
  R: number;
  visible: boolean;
  last: number;
  playStart: number;
  still: boolean;
  label: string;
  playing: boolean;
  ready: boolean;
}

const mounted = new Set<Mounted>();
let running = false;

export function mountCard(host: HTMLElement, def: CardDef, opts: { label: string; still?: boolean }): { destroy(): void } {
  host.classList.add('lamp-host');
  host.dataset['category'] = def.category;
  host.dataset['label'] = '';
  host.dataset['playing'] = '0';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'button');
  canvas.setAttribute('aria-label', `${opts.label}. Press to play.`);
  host.append(canvas);
  const off = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const octx = off.getContext('2d');
  if (!ctx || !octx) throw new Error('canvas 2D is not available');

  const s: CardState = {
    el: host, W: 0, H: 0, x: 0, y: 0, inside: false, lx: 0, ly: 0, sec: 0,
    p: -1, playing: false, sweep: -1, keep: 1,
    C: {} as Record<ColourKey, Rgb>,
    seed: mounted.size * 1.7,
    U: (u) => PAD + u * (s.W - 2 * PAD),
    V: (v) => PAD + v * (s.H - 2 * PAD),
    u: (x) => (x - PAD) / (s.W - 2 * PAD),
    wAt: (x, y) => (calm() ? 1 : lampWeight(x - s.lx, y - s.ly, m.R)),
    lit: (x, y, when) => Math.max(s.wAt(x, y), s.sweep >= 0 && when <= s.sweep ? s.keep : 0),
  };
  const m: Mounted = {
    s, def, canvas, ctx, off, octx, R: 0, visible: true, last: -Infinity, playStart: -1,
    still: !!opts.still, label: '', playing: false, ready: false,
  };
  readColours(m);

  const at = (e: PointerEvent): void => {
    const r = canvas.getBoundingClientRect();
    s.x = e.clientX - r.left;
    s.y = e.clientY - r.top;
    s.inside = true;
    m.last = performance.now();
  };
  canvas.addEventListener('pointermove', at);
  canvas.addEventListener('pointerdown', at);
  canvas.addEventListener('pointerleave', () => { s.inside = false; });
  canvas.addEventListener('pointercancel', () => { s.inside = false; });
  canvas.addEventListener('click', () => play(m));
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    play(m);
  });

  const size = (): void => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!r.width || !r.height) return;
    for (const c of [canvas, off]) {
      c.width = Math.round(r.width * d);
      c.height = Math.round(r.height * d);
    }
    ctx.setTransform(d, 0, 0, d, 0, 0);
    octx.setTransform(d, 0, 0, d, 0, 0);
    const first = !s.W;
    s.W = r.width;
    s.H = r.height;
    m.R = lampRadius(s.W);
    if (first) [s.lx, s.ly] = wander(m, 0);
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { m.visible = !!e?.isIntersecting; });
  io.observe(canvas);

  mounted.add(m);
  start();
  return {
    destroy(): void {
      mounted.delete(m);
      ro.disconnect();
      io.disconnect();
      canvas.remove();
    },
  };
}

function readColours(m: Mounted): void {
  for (const key of Object.keys(TOKENS) as ColourKey[]) m.s.C[key] = parseRgb(cssColor(TOKENS[key], m.s.el));
}

function start(): void {
  if (running) return;
  running = true;
  const recolour = (): void => { for (const m of mounted) readColours(m); };
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);
  const frame = (ms: number): void => {
    for (const m of mounted) if (m.visible) draw(m, ms);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function play(m: Mounted): void {
  if (m.still) return;
  m.def.onPlay?.(m.s);
  const a = audio();
  if (a && m.def.audio) {
    try {
      m.def.audio(a, a.currentTime + 0.06, m.s);
    } catch {
      // The sound is a bonus: the picture plays regardless.
    }
  }
  m.playStart = performance.now() + 60;
}

function wander(m: Mounted, sec: number): Point {
  const { s, def } = m;
  if (def.wander) return def.wander(s, sec);
  const t = 0.5 + 0.4 * Math.sin(sec * 0.3 + s.seed);
  return def.rest(s, Math.floor(def.strings / 2), t, sec);
}

const sweepX = (s: CardState, p: number): number => s.U(p);

function draw(m: Mounted, ms: number): void {
  const { s, def, ctx } = m;
  const { W, H, C } = s;
  if (!W || !H) return;
  const quiet = calm();
  s.sec = m.still ? 1 : quiet ? 0 : ms / 1000;

  // Where the lamp is: fixed in a still; else easing toward the pointer, or
  // wandering when idle (and staying put under reduced motion).
  if (m.still) {
    const [u, v] = def.still ?? [0.5, 0.5];
    s.lx = u * W;
    s.ly = v * H;
  } else {
    const idle = !s.inside || ms - m.last > IDLE_MS;
    if (!(quiet && idle)) {
      const [tx, ty] = idle ? wander(m, ms / 1000) : [s.x, s.y];
      const k = idle ? 0.04 : 0.25;
      s.lx += (tx - s.lx) * k;
      s.ly += (ty - s.ly) * k;
    }
  }

  const ps = m.still || quiet ? playState(ms, -1, 1) : playState(ms, m.playStart, (def.dur ?? 3.2) * 1000, RELAX_MS);
  s.p = ps.p;
  s.playing = ps.playing;
  s.sweep = ps.sweep;
  s.keep = ps.keep;
  if (ps.playing !== m.playing) {
    m.playing = ps.playing;
    s.el.dataset['playing'] = ps.playing ? '1' : '0';
  }

  ctx.fillStyle = rgba(C.ground2, 1);
  ctx.fillRect(0, 0, W, H);
  def.surface?.(s, ctx, s.sec);
  light(m, quiet);

  // The strings: each in a few paths by how taut and intense its pieces are.
  const mid = (def.strings - 1) / 2, N = def.points ?? POINTS;
  for (let k = 0; k < def.strings; k++) {
    const paths = Array.from({ length: LEVELS + 1 }, () => new Path2D());
    let px = 0, py = 0;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const [rx, ry] = def.rest(s, k, t, s.sec);
      const [tx, ty] = def.tight(s, k, t, s.sec);
      let w = s.wAt(rx, ry);
      if (def.lift) w = Math.max(w, def.lift(s, k, t));
      if (s.sweep >= 0) w = Math.max(w, behind(def.when ? def.when(k, t) : t, s.sweep, s.keep));
      const x = rx + (tx - rx) * w, y = ry + (ty - ry) * w;
      if (i > 0) {
        const lv = Math.round(clamp(def.intensity ? def.intensity(s, k, t, w) : w, 0, 1) * LEVELS);
        const path = paths[lv]!;
        path.moveTo(px, py);
        path.lineTo(x, y);
      }
      px = x;
      py = y;
    }
    const col = C[def.colour?.(k) ?? 'acc'];
    const base = def.base ? def.base(k) : Math.abs(k - mid) < 0.6 ? 0.7 : 0.3;
    for (let lv = 0; lv <= LEVELS; lv++) {
      const w = lv / LEVELS;
      ctx.strokeStyle = rgba(mixRgb(C.mut, col, w), base + (1 - base) * w * 0.9);
      ctx.lineWidth = 1 + w * (def.thick ?? 0.4);
      ctx.stroke(paths[lv]!);
    }
  }
  def.over?.(s, ctx, s.sec);

  // The playhead and its label while playing; otherwise the lamp's label.
  let label = '';
  if (s.playing) {
    ctx.strokeStyle = rgba(C.acc, 0.55);
    ctx.lineWidth = 1;
    if (def.playhead) def.playhead(s, ctx, s.p);
    else {
      const x = (def.sweepX ?? sweepX)(s, s.p);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    const pl = def.playLabel?.(s, s.p);
    if (pl) tag(s, ctx, pl.text, pl.x, pl.y, C.acc);
  } else if (def.label && (s.inside || !quiet)) {
    label = def.label(s, s.lx, s.ly) ?? '';
    if (label) tag(s, ctx, label, s.lx + m.R * 0.45, s.ly - m.R * 0.45);
  }
  if (label !== m.label) {
    m.label = label;
    s.el.dataset['label'] = label;
  }
  if (!m.ready) {
    m.ready = true;
    s.el.dataset['ready'] = '1';
  }
}

/* The backdrop shows through the lamp, and everywhere the playhead has
   passed; under reduced motion it shows whole. */
function light(m: Mounted, quiet: boolean): void {
  const { s, def, ctx, off, octx } = m;
  const backdrop = def.backdrop;
  if (!backdrop) return;
  const { W, H } = s;
  const pass = (mask: (() => void) | null): void => {
    octx.globalCompositeOperation = 'source-over';
    octx.clearRect(0, 0, W, H);
    backdrop(s, octx);
    if (mask) {
      octx.globalCompositeOperation = 'destination-in';
      mask();
    }
    ctx.drawImage(off, 0, 0, W, H);
  };
  if (quiet) {
    pass(null);
    return;
  }
  pass(() => {
    const g = octx.createRadialGradient(s.lx, s.ly, m.R * 0.4, s.lx, s.ly, m.R * 1.1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = g;
    octx.fillRect(0, 0, W, H);
  });
  if (s.sweep >= 0 && s.keep > 0) {
    pass(() => {
      octx.fillStyle = `rgba(0,0,0,${s.keep})`;
      if (def.sweepMask) def.sweepMask(s, octx, s.sweep);
      else {
        octx.beginPath();
        octx.rect(0, 0, (def.sweepX ?? sweepX)(s, s.sweep), H);
      }
      octx.fill();
    });
  }
}

/** A small label on a ground-coloured strip, kept inside the card. */
function tag(s: CardState, c: CanvasRenderingContext2D, text: string, x: number, y: number, colour: Rgb = s.C.ink): void {
  mono(c, 10);
  const tw = c.measureText(text).width;
  const cx = clamp(x, 4, Math.max(4, s.W - tw - 8));
  const cy = clamp(y, 12, s.H - 6);
  c.fillStyle = rgba(s.C.ground2, 0.92);
  c.fillRect(cx - 3, cy - 10, tw + 6, 14);
  c.fillStyle = rgba(colour, 1);
  c.fillText(text, cx, cy);
}
```

- [ ] **Step 4: Port the Starling card**

Create `src/lamp/cards/starling.ts` (from `docs/superpowers/prototypes/lamp/cards/starling.js`):

```ts
/* Starling: a voice becomes notes, every slide kept. At rest the voice is a
   bundle of strings swaying around the sung pitch, wider where it is louder;
   taut, it lies on the notes it found. */

import { hz, nameOf, rgba } from '../core.js';
import { mono, type CardDef, type CardState } from '../engine.js';

interface Note { a: number; b: number; n: number; v?: boolean }
const NOTES: Note[] = [
  { a: 0.03, b: 0.16, n: 60 }, { a: 0.2, b: 0.31, n: 64 }, { a: 0.35, b: 0.52, n: 62, v: true },
  { a: 0.56, b: 0.71, n: 67 }, { a: 0.75, b: 0.85, n: 65 }, { a: 0.88, b: 0.98, n: 64, v: true },
];
const FIRST = NOTES[0]!, LAST = NOTES[NOTES.length - 1]!;
const T0 = FIRST.a, T1 = LAST.b, LO = 55, HI = 71;

const noteAt = (t: number): Note | null => NOTES.find((n) => t >= n.a && t <= n.b) ?? null;
const yOf = (s: CardState, n: number): number => s.V(1 - (n - LO) / (HI - LO));

/** The sung pitch at t: each note scooped into, some with vibrato, sliding between. */
function semi(t: number): number {
  for (let i = 0; i < NOTES.length; i++) {
    const n = NOTES[i]!;
    if (t >= n.a && t <= n.b) {
      const p = (t - n.a) / (n.b - n.a), prev = i ? NOTES[i - 1]!.n : n.n - 1;
      const scoop = p < 0.18 ? (prev - n.n) * (1 - p / 0.18) ** 2 * 0.5 : 0;
      const vib = n.v ? Math.sin(p * 44) * 0.35 * Math.min(1, p * 3) : 0;
      return n.n + scoop + vib;
    }
    const next = NOTES[i + 1];
    if (next && t > n.b && t < next.a) {
      const q = (t - n.b) / (next.a - n.b);
      return n.n + (next.n - n.n) * q * q * (3 - 2 * q);
    }
  }
  return t < T0 ? FIRST.n : LAST.n;
}

/** How loud the voice is at t. */
function amp(t: number): number {
  const n = noteAt(t);
  if (!n) return 0.35;
  const p = (t - n.a) / (n.b - n.a);
  return 0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, p * 1.15 + 0.04));
}

const u = (t: number): number => T0 + (T1 - T0) * t;

/** What the voice is doing at a point: holding a note, or sliding between two. */
function say(x: number): string | null {
  const n = noteAt(x);
  if (n) return n.v ? `${nameOf(n.n)} · vibrato kept` : nameOf(n.n);
  const i = NOTES.findIndex((m) => m.a > x);
  return i > 0 ? `slide ${nameOf(NOTES[i - 1]!.n)} → ${nameOf(NOTES[i]!.n)} · kept` : null;
}

export const starling: CardDef = {
  id: 'voxmpe',
  category: 'transcribe',
  still: [0.42, 0.42],
  strings: 9,
  rest: (s, k, t, sec) => {
    const x = u(t), a = amp(x);
    return [s.U(x), yOf(s, semi(x)) + (k - 4) * a * 4.5 + Math.sin(x * 9 + sec * 0.7 + k * 0.8) * a * 1.5];
  },
  tight: (s, k, t) => {
    const x = u(t), n = noteAt(x);
    return [s.U(x), (n ? yOf(s, n.n) : yOf(s, semi(x))) + (k - 4) * 0.7];
  },
  when: (_k, t) => u(t),
  backdrop: (s, o) => {
    o.strokeStyle = rgba(s.C.line, 1);
    o.lineWidth = 1;
    for (let n = LO; n <= HI; n++) {
      const y = yOf(s, n);
      o.beginPath();
      o.moveTo(0, y);
      o.lineTo(s.W, y);
      o.stroke();
    }
    mono(o, 10);
    o.fillStyle = rgba(s.C.ink, 1);
    for (const n of NOTES) o.fillText(nameOf(n.n), s.U(n.a), yOf(s, n.n) - 9);
  },
  label: (s, x) => say(s.u(x)),
  playLabel: (s, p) => {
    const text = say(p);
    return text ? { text, x: s.U(p) + 8, y: s.V(0.04) } : null;
  },
  audio: (a, at) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    g.gain.setValueAtTime(0, at);
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, when = at + t * 3.2;
      o.frequency.linearRampToValueAtTime(hz(semi(t)), when);
      g.gain.linearRampToValueAtTime(t < T0 || t > T1 ? 0 : 0.14 * amp(t), when);
    }
    o.connect(g).connect(a.destination);
    o.start(at);
    o.stop(at + 3.3);
  },
};
```

- [ ] **Step 5: The registry**

Create `src/lamp/cards/index.ts`:

```ts
/* Every project's lamp card, by project id (the ids in src/data/projects.ts). */

import type { CardDef } from '../engine.js';
import { starling } from './starling.js';

export const LAMP_CARDS: Record<string, CardDef> = {
  voxmpe: starling,
};
```

- [ ] **Step 6: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 7: Start the dev server** (background, keep it running for the rest of the plan)

Run (in the background): `npm run dev -- --port 4317 --strictPort`

- [ ] **Step 8: Run the browser check**

Run: `npm run check:lamp -- http://localhost:4317/`
Expected: `no problems`. Open `.peek/lamp/voxmpe-paper-lamp.png` and `voxmpe-paper-play.png` and compare with the prototype (`docs/superpowers/prototypes/lamp/all-lamp.html`, first card): the same strings, lamp and playhead.

- [ ] **Step 9: Make sure the gallery stays out of the build**

Run: `npm run build`
Expected: succeeds, and `dist/` has no `lamp-gallery.html` (check with the Glob tool: `dist/**/lamp-gallery*` finds nothing).

- [ ] **Step 10: Commit**

```
git add src/lamp/engine.ts src/lamp/cards/starling.ts src/lamp/cards/index.ts src/lamp/gallery.ts lamp-gallery.html scripts/lamp-check.mjs
git commit -m "Add the lamp engine, a dev gallery, a browser check and Starling's card" -m "The engine draws a card in strings: the lamp under the pointer pulls them taut, a click plays and sweeps a playhead, labels live in the lamp. It also handles keys, reduced motion, theme switches and still captures." -m "scripts/lamp-check.mjs checks every card in Chrome, including no sound, fast clicks, reduced motion, a theme switch and a phone. The gallery page is served in dev only." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Coming Undone and Rearranged

**Files:**
- Create: `src/lamp/cards/coming-undone.ts` (from `docs/superpowers/prototypes/lamp/cards/coming-undone.js`)
- Create: `src/lamp/cards/rearranged.ts` (from `docs/superpowers/prototypes/lamp/cards/rearranged.js`)
- Modify: `src/lamp/cards/index.ts`

**Interfaces:**
- Consumes: `CardDef`, `CardState`, `ColourKey`, `mono` from `engine.ts`; `clamp`, `smooth`, `rgba` from `core.ts`; `tone`, `hit` from `sound.ts`.
- Produces: `export const comingUndone: CardDef` (`id: 'stemscribe'`), `export const rearranged: CardDef` (`id: 'rearranged'`).

**Port rules** (the same for every card ported in this plan):
1. Copy the prototype file's header comment and code into the new `.ts` file.
2. Remove the outer `{ ... }` block (or, for Rearranged, the `rearrangedCard` function): its consts become module scope.
3. Replace `card({ name, category, line, tag?, ...rest })` with `export const <name>: CardDef = { id: '<project id>', category: '<category>', still: [<u>, <v>], ...rest }`. Drop `name`, `line` and `tag`: the words come from `src/data/projects.ts`.
4. Imports: from `'../core.js'` the helpers used (`clamp`, `smooth`, `rgba`, `nameOf`, `hz`, `mixRgb`); from `'../engine.js'` `calm`, `mono` and the types `CardDef`, `CardState`, `ColourKey`; from `'../sound.js'` `tone`, `hit`. Import only what the card uses (`noUnusedLocals` is on).
5. Sound calls take the AudioContext first: `tone(m, at, ...)` becomes `tone(a, m, at, ...)`, `hit(kind, at, gain)` becomes `hit(a, kind, at, gain)`, and the card's `audio: (at, s) =>` becomes `audio: (a, at, s) =>`.
6. The prototype's `still` (reduced motion) becomes `calm()`.
7. Give local helpers parameter types (`s: CardState`, numbers), type colour names as `ColourKey`, and add `!` on array reads whose index is in range by construction.
8. Keep every label string exactly as in the prototype.

- [ ] **Step 1: Port Coming Undone**

Apply the port rules to `coming-undone.js`, with `export const comingUndone`, `id: 'stemscribe'`, `category: 'transcribe'`, `still: [0.62, 0.5]`. Type `COL` as `ColourKey[]`: `const COL: ColourKey[] = ['snare', 'perc', 'hats', 'kick'];`.

- [ ] **Step 2: Port Rearranged (the chosen version only)**

Apply the port rules to `rearranged.js`, with `export const rearranged`, `id: 'rearranged'`, `category: 'transform'`, `still: [0.35, 0.24]`, and these changes:
- Keep only the `'morph'` behaviour: in `place`, keep `if (row === 'before') y += (stringY(s, row, j, t, 'after') - y) * w;` and delete the `'touch'` line, the `motion` and `extra` parameters, the `REARRANGED_MANUAL` line and the comment block about the three motions.
- Type the rows: `type Row = 'before' | 'after';` and use it for `ROW`, `rowAt`, `pitchY`, `pressed` and `stringY`.
- Move the row choice out of `audio` into `onPlay: (s) => { s.row = rowAt(s, s.y); },` and in `audio` and `playLabel` read it as `const row: Row = s.row === 'after' ? 'after' : 'before';`.
- The label for the before row is the morph one: `` `before → after · ${ch}, one press becomes two` ``.

- [ ] **Step 3: Register both**

In `src/lamp/cards/index.ts`, import them and extend the record:

```ts
import { comingUndone } from './coming-undone.js';
import { rearranged } from './rearranged.js';
import { starling } from './starling.js';

export const LAMP_CARDS: Record<string, CardDef> = {
  voxmpe: starling,
  stemscribe: comingUndone,
  rearranged,
};
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Run the browser check**

Run: `npm run check:lamp -- http://localhost:4317/`
Expected: `no problems`. Look at `.peek/lamp/stemscribe-paper-play.png` (four coloured lanes behind the playhead) and `rearranged-paper-lamp.png` (the top row splitting into two presses under the lamp). If a label check fails, look at that card's `-lamp.png`: fix the port if the card differs from the prototype; if the card matches the prototype and only the test point misses its target, move the point in `EXPECT` and say why in the commit message.

- [ ] **Step 6: Commit**

```
git add src/lamp/cards/coming-undone.ts src/lamp/cards/rearranged.ts src/lamp/cards/index.ts scripts/lamp-check.mjs
git commit -m "Add Coming Undone's and Rearranged's lamp cards" -m "Coming Undone: one song parts into four lanes, each written as its part. Rearranged: before and after rows of the same chords; under the lamp the before row's presses split into the after pattern." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ready Set and YSAD

**Files:**
- Create: `src/lamp/cards/ready-set.ts` (from `docs/superpowers/prototypes/lamp/cards/ready-set.js`)
- Create: `src/lamp/cards/ysad.ts` (from `docs/superpowers/prototypes/lamp/cards/ysad.js`)
- Modify: `src/lamp/cards/index.ts`

**Interfaces:**
- Consumes: as Task 4.
- Produces: `export const readySet: CardDef` (`id: 'tabridge'`), `export const ysad: CardDef` (`id: 'ysad'`).

**Port rules** (the same for every card ported in this plan):
1. Copy the prototype file's header comment and code into the new `.ts` file.
2. Remove the outer `{ ... }` block: its consts become module scope.
3. Replace `card({ name, category, line, tag?, ...rest })` with `export const <name>: CardDef = { id: '<project id>', category: '<category>', still: [<u>, <v>], ...rest }`. Drop `name`, `line` and `tag`.
4. Imports: from `'../core.js'` the helpers used (`clamp`, `smooth`, `rgba`, `nameOf`, `hz`, `mixRgb`); from `'../engine.js'` `calm`, `mono` and the types `CardDef`, `CardState`, `ColourKey`; from `'../sound.js'` `tone`, `hit`. Import only what the card uses.
5. Sound calls take the AudioContext first: `tone(a, m, at, ...)`, `hit(a, kind, at, gain)`, and `audio: (a, at, s) =>`.
6. The prototype's `still` (reduced motion) becomes `calm()`.
7. Give local helpers parameter types, type colour names as `ColourKey`, add `!` on in-range array reads.
8. Keep every label string exactly as in the prototype.

- [ ] **Step 1: Port Ready Set**

Apply the port rules to `ready-set.js`, with `export const readySet`, `id: 'tabridge'`, `category: 'transform'`, `still: [0.4, 0.45]`. Type `ROLE` as `('you' | 'chords' | 'bass' | 'drums')[]` and `LANE` as `Record<'you' | 'chords' | 'bass' | 'drums', [number, number]>`; `mid` takes that union. In `label`, sort `Object.entries(LANE)` with the role typed: `(Object.entries(LANE) as ['you' | 'chords' | 'bass' | 'drums', [number, number]][])`.

- [ ] **Step 2: Port YSAD**

Apply the port rules to `ysad.js`, with `export const ysad`, `id: 'ysad'`, `category: 'transform'`, `still: [0.62, 0.38]`. Type `RINGS` as `('kick' | 'snare' | 'perc' | 'hats')[]` and `PROB` as `Record<'kick' | 'snare' | 'perc' | 'hats', Record<number, number>>`. The hand's turn reads `s.sec` (which the engine freezes under reduced motion) and the `still` checks in `lift` and `over` become `calm()`. The audio parameter that the prototype named `at0` stays `at`: `audio: (a, at) => { ... hit(a, name, at + i * BAR / 16) ... }`.

- [ ] **Step 3: Register both**

In `src/lamp/cards/index.ts` add the imports and entries:

```ts
import { readySet } from './ready-set.js';
import { ysad } from './ysad.js';
```

```ts
  tabridge: readySet,
  ysad,
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Run the browser check**

Run: `npm run check:lamp -- http://localhost:4317/`
Expected: `no problems`. Look at `.peek/lamp/tabridge-paper-play.png` (clips for chords, bass and drums, the empty "your part" lane, chord symbols moving into the chords clip) and `ysad-paper-lamp.png` (four rings, round string discs at the hits, the hand). Same rule as Task 4 if a label point misses.

- [ ] **Step 6: Commit**

```
git add src/lamp/cards/ready-set.ts src/lamp/cards/ysad.ts src/lamp/cards/index.ts scripts/lamp-check.mjs
git commit -m "Add Ready Set's and YSAD's lamp cards" -m "Ready Set: a lead sheet becomes a band in Ableton Live, with your part left open. YSAD: the circle's four rings, hits as discs of string, a hand that always turns." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Session Notes and Tagline

**Files:**
- Create: `src/lamp/cards/session-notes.ts` (from `docs/superpowers/prototypes/lamp/cards/session-notes.js`)
- Create: `src/lamp/cards/tagline.ts` (from `docs/superpowers/prototypes/lamp/cards/tagline.js`)
- Modify: `src/lamp/cards/index.ts`

**Interfaces:**
- Consumes: as Task 4.
- Produces: `export const sessionNotes: CardDef` (`id: 'session-notes'`), `export const tagline: CardDef` (`id: 'intentional'`). After this task `LAMP_CARDS` has all seven ids.

**Port rules** (the same for every card ported in this plan):
1. Copy the prototype file's header comment and code into the new `.ts` file.
2. Remove the outer `{ ... }` block: its consts become module scope.
3. Replace `card({ name, category, line, tag?, ...rest })` with `export const <name>: CardDef = { id: '<project id>', category: '<category>', still: [<u>, <v>], ...rest }`. Drop `name`, `line` and `tag`.
4. Imports: from `'../core.js'` the helpers used (`clamp`, `smooth`, `rgba`, `nameOf`, `hz`, `mixRgb`); from `'../engine.js'` `calm`, `mono` and the types `CardDef`, `CardState`, `ColourKey`; from `'../sound.js'` `tone`, `hit`. Import only what the card uses.
5. Sound calls take the AudioContext first: `tone(a, m, at, ...)`, `hit(a, kind, at, gain)`, and `audio: (a, at, s) =>`.
6. The prototype's `still` (reduced motion) becomes `calm()`.
7. Give local helpers parameter types, type colour names as `ColourKey`, add `!` on in-range array reads.
8. Keep every label string exactly as in the prototype.

- [ ] **Step 1: Port Session Notes**

Apply the port rules to `session-notes.js`, with `export const sessionNotes`, `id: 'session-notes'`, `category: 'workflow'`, `still: [0.4, 0.55]`. The verse must read exactly:

```ts
const LYR = [
  { bar: 1, text: 'low sun, high tide' },
  { bar: 5, text: 'swallow whole the off-key hums' },
  { bar: 9, text: 'then slowly fade from sight' },
];
```

- [ ] **Step 2: Port Tagline**

Apply the port rules to `tagline.js`, with `export const tagline`, `id: 'intentional'`, `category: 'workflow'`, `still: [0.3, 0.38]`. Type a capture as `interface Capture { why: string; keep: string[] | null }`; in `over`, read `CAPS[k]!.keep!` (keepers only are iterated there).

- [ ] **Step 3: Register both**

In `src/lamp/cards/index.ts` add the imports and entries:

```ts
import { sessionNotes } from './session-notes.js';
import { tagline } from './tagline.js';
```

```ts
  'session-notes': sessionNotes,
  intentional: tagline,
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Run the browser check**

Run: `npm run check:lamp -- http://localhost:4317/`
Expected: `no problems`, with all seven cards listed in `.peek/lamp/`. Look at `session-notes-paper-play.png` (lines pulling taut into clips at bars 1, 5 and 9) and `intentional-paper-play.png` (keepers straight with hashtags, drops fallen).

- [ ] **Step 6: Commit**

```
git add src/lamp/cards/session-notes.ts src/lamp/cards/tagline.ts src/lamp/cards/index.ts scripts/lamp-check.mjs
git commit -m "Add Session Notes' and Tagline's lamp cards" -m "Session Notes: the verse's lines pull taut into clips at their bars. Tagline: captures triaged, keepers straightened with their hashtags, drops falling away." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The welcome page

**Files:**
- Modify: `src/ui/home.ts` (WANTS comments, `wantItem`, the stream's selector; replace `thumbLink`, `currentTheme` and `visual`)
- Modify: `src/styles/app.css` (the visual's rules)

**Interfaces:**
- Consumes: `mountCard` from `src/lamp/engine.ts`, `LAMP_CARDS` from `src/lamp/cards/index.ts`.
- Produces: each item's visual is `div.thumb-col` holding `div.thumb.lamp-thumb` (the card, with the name tag) and `a.cue` (the only link).

- [ ] **Step 1: Imports**

In `src/ui/home.ts`, remove `import { VISUALS } from '../data/visuals.generated.js';` and add:

```ts
import { LAMP_CARDS } from '../lamp/cards/index.js';
import { mountCard } from '../lamp/engine.js';
```

- [ ] **Step 2: The names go on the corner**

In `WANTS`, replace each of the three comments `// The loop is cropped below the plugin's header, so the name goes on the corner.`, `// The loop is cropped below the studio's header, so the name goes on the corner.` and `// The loop comes from the demo, below its wordmark, so the name goes on the corner.` with `// The card has no wordmark, so the name goes on the corner.`, and change Coming Undone's `nameOn: 'picture',` to `nameOn: 'corner',`. Then use the Grep tool for `nameOn: 'picture'` in `src/ui/home.ts`; change any other one to `'corner'` the same way.

- [ ] **Step 3: Replace the visual**

Delete the functions `thumbLink`, `currentTheme` and `visual` (from the comment `/* The visual as the way in:` to the end of `visual`), and add in their place:

```ts
/* The visual beside each summary: the project's lamp card (src/lamp/), drawn
   in strings, which plays on a click, and under its bottom-right edge the way
   in: "Try the demo" where the tool has a live demo, "Read how it works"
   otherwise. The card plays, so only the button is a link. */
function lampSide(w: Want, p: ProjectEntry, page: string): HTMLElement | null {
  const def = LAMP_CARDS[p.id];
  if (!def) return null;
  const live = !!p.live && 'url' in p.live;
  const box = el('div', { class: 'thumb lamp-thumb' });
  mountCard(box, def, { label: `${w.name}: ${p.summary ?? p.lead}` });
  if (w.nameOn) box.append(nameTag(w, p));
  const link = el(
    'a',
    { class: 'cue', href: live ? `${page}#demo` : page },
    live ? 'Try the demo' : 'Read how it works',
    el('span', { class: 'cue-arrow', 'aria-hidden': 'true' }, ' →'),
  );
  return el('div', { class: 'thumb-col' }, box, link);
}

/** The name as a tag on the card's corner (the heading stays for screen readers). */
function nameTag(w: Want, p: ProjectEntry): HTMLElement {
  return el(
    'span',
    { class: 'name-tag', 'aria-hidden': 'true' },
    // A short name hides its long one, shown on hover (YSAD's easter egg).
    el('span', { class: 'name' }, w.name),
    ...(p.fullName ? [el('span', { class: 'name full' }, p.fullName)] : []),
    // The tool's line, unless the want above already says it.
    ...(p.line && p.line !== w.want ? [el('span', { class: 'tool-line' }, p.line)] : []),
  );
}
```

- [ ] **Step 4: Use it in the item**

In `wantItem`, replace

```ts
  const side = p?.coming ? [] : page && p ? [thumbLink(w, p, page)] : [visual(p)];
```

with

```ts
  const lamp = p && page && !p.coming ? lampSide(w, p, page) : null;
  const side = lamp ? [lamp] : [];
```

- [ ] **Step 5: The stream finds the new visual**

In the stream's `redraw`, replace `li.querySelector<HTMLElement>('.thumb-link, :scope > .thumb')` with `li.querySelector<HTMLElement>('.thumb-col')`.

- [ ] **Step 6: Styles**

In `src/styles/app.css`:
1. Replace every `.thumb-link` in a selector with `.thumb-col` (the Edit tool with `replace_all`; lines around 120, 127 and the `.name-tag` rules around 149 to 166).
2. Delete the block from the comment `/* The visual is the way in: the whole of it links to the tool's page.` through the `@media (prefers-reduced-motion: reduce)` rule that ends it (the `.veil`, `.preview-tag`, `.cue`, hover and focus rules), and the three `.thumb.slot` rules after `/* An empty slot fills the item's height beside the text. */` (keep `.thumb { border ... }` and `.thumb img, .thumb video { ... }`).
3. Add in place of the deleted block:

```css
/* The visual beside each summary: the lamp card (src/lamp/), with the way in
   hanging under its bottom-right edge like a tab. The card plays on a click;
   only the button is a link. */
.thumb-col { position: relative; display: flex; flex-direction: column; height: 100%; }
.thumb-col > .lamp-thumb { position: relative; flex: 1; min-height: 300px; }
.thumb-col .name-tag { pointer-events: none; }
.thumb-col > .cue {
  align-self: flex-end; margin-top: -1px; border-radius: 0 0 var(--radius) var(--radius);
  display: inline-flex; align-items: center; gap: .5ch; min-height: 40px;
  padding: calc(var(--space) * .75) calc(var(--space) * 1.75);
  background: var(--acc); border: 1px solid var(--acc);
  font: 600 14px/1.2 var(--font-mono); color: var(--ground); white-space: nowrap; text-decoration: none;
  transition: background-color .35s ease-in-out, border-color .35s ease-in-out;
}
.thumb-col > .cue .cue-arrow { color: inherit; }
@media (hover: hover) { .thumb-col > .cue:hover { background: var(--ink); border-color: var(--ink); } }
.thumb-col > .cue:focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; background: var(--ink); border-color: var(--ink); }
.lamp-thumb canvas:focus-visible { outline: 2px solid var(--acc); outline-offset: -2px; }
@media (max-width: 720px) {
  .thumb-col > .lamp-thumb { min-height: 260px; }
  .thumb-col > .cue { min-height: 34px; padding: calc(var(--space) * .5) calc(var(--space) * 1.1); font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) { .thumb-col > .cue { transition: none; } }
```

- [ ] **Step 7: Typecheck and build**

Run: `npm run check`
Expected: no errors (if `noUnusedLocals` reports a leftover helper only the old visual used, delete it).
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Check the site in Chrome**

Run (in the background): `npx vite preview --port 4180 --strictPort`
Run: `npm run check:site -- http://localhost:4180/`
Expected: `no problems`.
Run: `npm run peek -- http://localhost:4180/`
Expected: in the desktop and phone screenshots, each tool has its card with the name on the corner and the accent button under it; nothing reads "preview".

- [ ] **Step 9: Commit**

```
git add src/ui/home.ts src/styles/app.css
git commit -m "Welcome page: each tool's visual is its lamp card" -m "The card replaces the studio screenshot or loop and plays on a click. The way in moves to the button under it, the only link, so the preview tag and the hover veil go." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Project pages

**Files:**
- Modify: `src/ui/project.ts` (`renderProject`)
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `mountCard`, `LAMP_CARDS`.
- Produces: `section.lamp-wide` on each project page, between the head and the rest.

- [ ] **Step 1: Imports**

In `src/ui/project.ts` add:

```ts
import { LAMP_CARDS } from '../lamp/cards/index.js';
import { mountCard } from '../lamp/engine.js';
```

- [ ] **Step 2: Place the card**

In `renderProject`, just before `if (liveBeat && p.live && 'url' in p.live && p.parts) {`, add:

```ts
  // The project's lamp card (src/lamp/): on its own, wide, between the head and the rest.
  const def = LAMP_CARDS[p.id];
  const lamp = def ? el('section', { class: 'lamp-wide' }) : null;
  if (lamp && def) mountCard(lamp, def, { label: `${p.name}: ${p.summary ?? p.lead}` });
```

and replace the three branches that follow with:

```ts
  if (liveBeat && p.live && 'url' in p.live && p.parts) {
    // The new layout: the description on its own, the card, then the demo
    // full width below it, at its own full height.
    main.append(el('section', { class: 'project-hero single' }, text));
    if (lamp) main.append(lamp);
    const demo = liveDemo(p.live.url, p.name, liveBeat.title);
    const wide = el('section', { class: 'demo-wide' }, demo.node);
    main.append(wide);
    demo.fit(wide, wide);
  } else if (liveBeat && p.live && 'url' in p.live) {
    const demo = liveDemo(p.live.url, p.name, liveBeat.title);
    const hero = el('section', { class: 'project-hero' }, text, demo.node);
    main.append(hero);
    demo.fit(hero, text);
    if (lamp) main.append(lamp);
  } else {
    main.append(el('section', { class: 'project-hero single' }, text));
    if (lamp) main.append(lamp);
  }
```

- [ ] **Step 3: Style**

At the end of the project page rules in `src/styles/app.css` (after the `.demo-wide` rules), add:

```css
/* A project page's lamp card: on its own, wide, between the head and the rest. */
.lamp-wide { margin: calc(var(--space) * 4) 0; height: clamp(320px, 38vw, 480px); border: var(--hairline); background: var(--ground-2); }
@media (max-width: 720px) { .lamp-wide { height: 300px; margin: calc(var(--space) * 2.5) 0; } }
```

- [ ] **Step 4: Typecheck, build, check**

Run: `npm run check`
Expected: no errors.
Run: `npm run build`
Expected: succeeds.
Run: `npm run check:site -- http://localhost:4180/` (restart `npx vite preview --port 4180 --strictPort` in the background first if it stopped)
Expected: `no problems`.
Run: `npm run peek -- http://localhost:4180/voxmpe/`
Expected: the head, then the Starling card, then the demo.

- [ ] **Step 5: List the beats that still show recordings**

Use the Grep tool for `show: 'video'`, `show: 'image'` and `show: 'shots'` in `src/data/projects.ts`. Write the list (project, beat title, what it shows) into the final report for Bengisu, who decides beat by beat; change none of them in this plan.

- [ ] **Step 6: Commit**

```
git add src/ui/project.ts src/styles/app.css
git commit -m "Project pages: the lamp card between the head and the rest" -m "Each page shows its card on its own, wide, right after the head: before the demo where the demo sits below, after the head and demo where they share the first screen." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The screenshots and loops go to each project's repo

Do this before Task 10 deletes them from the showcase.

**Files (in other repos):**
- Create: `<repo>/media/*` and modify `<repo>/README.md` for Starling, Session Notes, Ready Set, Coming Undone, Rearranged and YSAD. Tagline has no repo: skip it.

**Interfaces:**
- Consumes: the files in `public/visuals/<id>/` as they are now.

| Project | Showcase id | Repo (spec) | Files to copy from `public/visuals/<id>/` | README picture: still, alt text |
|---|---|---|---|---|
| Starling | voxmpe | swwallowws/starling | `loop-paper.mp4`, `loop-night.mp4`, `loop-paper.png`, `loop-night.png`, `studio-paper.png`, `studio-night.png` | `studio-paper.png`, "Starling's studio: a sung phrase drawn as notes" |
| Coming Undone | stemscribe | swwallowws/coming-undone | `loop-*` (4 files), `full-paper.png`, `full-night.png` | `full-paper.png`, "Coming Undone: a song split into parts, each written as MIDI" |
| Rearranged | rearranged | private repo | `loop-*` (4 files), `lab-paper.png`, `lab-night.png` | `lab-paper.png`, "Rearranged's lab: a song's sections, rearranged" |
| Ready Set | tabridge | swwallowws/ready-set | `loop-*` (4 files), `site-paper.png`, `site-night.png` | `site-paper.png`, "Ready Set: a tab opened as a playable set" |
| YSAD | ysad | private repo | `loop-*` (4 files), `circle-paper.png`, `circle-night.png` | `circle-paper.png`, "YSAD's circle: a beat drawn around four rings" |
| Session Notes | session-notes | swwallowws/ableton-session-notes | `playground-paper.png`, `playground-night.png` | `playground-paper.png`, "Session Notes: lyric lines placed as clips on the timeline" |

- [ ] **Step 1: Find each local repo**

For each candidate folder, run one command each and match the `origin` to the table: `git -C ../voxmpe remote -v`, `git -C ../stemscribe remote -v`, `git -C ../rearranged remote -v`, `git -C ../ready-set-public remote -v`, `git -C ../yousuckatdrums remote -v`, `git -C ../ableton-session-notes remote -v`. (Ready Set's real folder is `ready-set-public`; `tabridge` pushes to an archive.) If a project's repo is not among these, stop and ask Bengisu which folder holds it.

- [ ] **Step 2: Copy the files** (per project, one `mkdir -p <repo>/media` and one `cp` per file)

Example for Starling, assuming Step 1 found it in `../voxmpe`:
Run: `mkdir -p ../voxmpe/media`
Run: `cp public/visuals/voxmpe/loop-paper.mp4 ../voxmpe/media/loop-paper.mp4`
(and so on for every file in that project's row)

- [ ] **Step 3: Add the README section** (per project)

Right after the README's first paragraph, add this, with the still and alt text from that project's row in the table (Starling shown):

```markdown
## In pictures

<a href="media/loop-paper.mp4"><img src="media/studio-paper.png" alt="Starling's studio: a sung phrase drawn as notes" width="720"></a>

Files to share: [loop, Paper](media/loop-paper.mp4) · [loop, Night](media/loop-night.mp4) · [still, Paper](media/studio-paper.png) · [still, Night](media/studio-night.png)
```

For Session Notes (stills only):

```markdown
## In pictures

<img src="media/playground-paper.png" alt="Session Notes: lyric lines placed as clips on the timeline" width="720">

Files to share: [still, Paper](media/playground-paper.png) · [still, Night](media/playground-night.png)
```

- [ ] **Step 4: Commit in each repo** (one commit per repo, no push)

```
git -C ../voxmpe add media README.md
git -C ../voxmpe commit -m "Add screenshots and loops to the README, with the files in media/" -m "Moved here from the showcase site, which now shows a drawn card instead; kept here for sharing." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Repeat per repo with its own path. Do not push: list the commits for Bengisu.)

---

### Task 10: Retire the screenshots and loops from the showcase

**Files:**
- Delete: the files listed in Task 9's table from `public/visuals/<id>/`
- Modify: `src/data/projects.ts` (the `loop` field and its five uses)
- Modify: `visuals/manifest.json` (`"shots": []`)
- Modify: `scripts/loops.mjs` (record into `.local-visuals/`)
- Modify: `scripts/visuals.mjs` (no loop preference)

**Interfaces:**
- Produces: the site with no studio stills or loops; `scripts/loops.mjs` still records loops, for refreshing the repos' `media/` by hand.

- [ ] **Step 1: Delete the files** (one command per project)

Run: `git rm public/visuals/voxmpe/loop-paper.mp4 public/visuals/voxmpe/loop-night.mp4 public/visuals/voxmpe/loop-paper.png public/visuals/voxmpe/loop-night.png public/visuals/voxmpe/studio-paper.png public/visuals/voxmpe/studio-night.png`
Run: `git rm public/visuals/stemscribe/loop-paper.mp4 public/visuals/stemscribe/loop-night.mp4 public/visuals/stemscribe/loop-paper.png public/visuals/stemscribe/loop-night.png public/visuals/stemscribe/full-paper.png public/visuals/stemscribe/full-night.png`
Run: `git rm public/visuals/rearranged/loop-paper.mp4 public/visuals/rearranged/loop-night.mp4 public/visuals/rearranged/loop-paper.png public/visuals/rearranged/loop-night.png public/visuals/rearranged/lab-paper.png public/visuals/rearranged/lab-night.png`
Run: `git rm public/visuals/tabridge/loop-paper.mp4 public/visuals/tabridge/loop-night.mp4 public/visuals/tabridge/loop-paper.png public/visuals/tabridge/loop-night.png public/visuals/tabridge/site-paper.png public/visuals/tabridge/site-night.png`
Run: `git rm public/visuals/ysad/loop-paper.mp4 public/visuals/ysad/loop-night.mp4 public/visuals/ysad/loop-paper.png public/visuals/ysad/loop-night.png public/visuals/ysad/circle-paper.png public/visuals/ysad/circle-night.png`
Run: `git rm public/visuals/session-notes/playground-paper.png public/visuals/session-notes/playground-night.png`

- [ ] **Step 2: Drop the `loop` field**

In `src/data/projects.ts`, delete the five lines `    loop: 'loop',` and, in `ProjectEntry`, the field with its comment:

```ts
  /** A silent loop of the real product for the welcome page, in place of the
      still: `public/visuals/<id>/<loop>-paper|night.mp4` with `.png` posters. */
  loop?: string;
```

- [ ] **Step 3: Empty the shot list**

In `visuals/manifest.json`, replace the whole `"shots": [ ... ]` array with `"shots": []` (Task 11 adds the lamp stills).

- [ ] **Step 4: Loops record into `.local-visuals/`**

In `scripts/loops.mjs`, replace `const out = join(root, "public/visuals", r.project);` with `const out = join(root, ".local-visuals", r.project);`, and in its header comment replace `public/visuals/<project>/loop-<theme>.mp4` with `.local-visuals/<project>/loop-<theme>.mp4 (gitignored; copied by hand into the project's repo, media/)`.

- [ ] **Step 5: No loop preference for thumbs**

In `scripts/visuals.mjs`, delete the comment lines starting `// A welcome-page loop's poster (loop-*.png, scripts/loops.mjs) wins when there` up to the line before `if (shots.includes("loop")) return "loop";`, and that line itself.

- [ ] **Step 6: Typecheck, build, check**

Run: `npm run check`
Expected: no errors.
Run: `npm run build`
Expected: succeeds.
Run: `npm run check:site -- http://localhost:4180/` (with `npx vite preview --port 4180 --strictPort` running)
Expected: `no problems` (no missing files: nothing asks for the deleted ones).

- [ ] **Step 7: Commit**

```
git add -A public/visuals src/data/projects.ts visuals/manifest.json scripts/loops.mjs scripts/visuals.mjs
git commit -m "Retire the studio screenshots and loops from the site" -m "They now live in each project's repo (media/, linked from its README). loops.mjs still records, into .local-visuals/, for refreshing those files." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Share cards from lamp stills

**Files:**
- Modify: `visuals/manifest.json` (seven lamp shots)
- Regenerated by `npm run visuals`: `public/visuals/<id>/lamp-*.png`, `public/visuals/<id>/card-*.png`, `src/data/visuals.generated.ts`

**Interfaces:**
- Consumes: the gallery's `?card=<id>&still=1` (Task 3) and the host's `data-ready="1"`.
- Produces: each project's share cards built around a still of its lamp card.

- [ ] **Step 1: Add the shots**

In `visuals/manifest.json`, set `"shots"` to:

```json
  "shots": [
    { "project": "voxmpe", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=voxmpe&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "stemscribe", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=stemscribe&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "rearranged", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=rearranged&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "tabridge", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=tabridge&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "ysad", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=ysad&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "session-notes", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=session-notes&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true },
    { "project": "intentional", "name": "lamp", "url": "http://localhost:4317/lamp-gallery.html?card=intentional&still=1", "viewport": [1200, 750], "selector": ".lamp-host", "actions": [{ "waitFor": ".lamp-host[data-ready='1']" }, { "wait": 400 }], "thumb": true }
  ]
```

- [ ] **Step 2: Capture** (the dev server from Task 3 Step 7 must be running on port 4317)

Run: `npm run visuals`
Expected: it logs `shot   <id>/lamp-paper.png` and `-night.png` for all seven, then the cards, then `index  src/data/visuals.generated.ts (8 projects)`.

- [ ] **Step 3: Look at the results**

Open, with the Read tool, `public/visuals/voxmpe/card-og-paper.png`, `public/visuals/ysad/card-og-night.png` and `public/visuals/session-notes/card-square-paper.png`. Expected: each card shows the lamp still, with its label in the lamp. If a still's lamp sits somewhere dull, change that card's `still: [u, v]` in its `src/lamp/cards/*.ts` and rerun Step 2.

- [ ] **Step 4: Typecheck, build, check**

Run: `npm run check`
Expected: no errors.
Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```
git add visuals/manifest.json public/visuals src/data/visuals.generated.ts src/lamp/cards
git commit -m "Share cards show each project's lamp card" -m "Each card's picture is a still of the lamp card in Paper and Night, captured from the dev gallery, in place of the studio screenshot." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Final check and hand-over

**Files:** none new.

- [ ] **Step 1: All automatic checks**

Run: `npm test` (expected: PASS)
Run: `npm run check` (expected: no errors)
Run: `npm run build` (expected: succeeds)
Run: `npm run check:site -- http://localhost:4180/` with the preview running (expected: `no problems`)
Run: `npm run check:lamp -- http://localhost:4317/` with the dev server running (expected: `no problems`)

- [ ] **Step 2: In Chrome** (claude-in-chrome when connected; otherwise `npm run peek` screenshots)

On `http://localhost:4180/` and two project pages (`voxmpe/`, `ysad/`): move the lamp over each card, click to play (sound and sweep), tab to a card and press Enter, switch Paper and Night, and repeat at phone width. Note anything that differs from the prototype.

- [ ] **Step 3: Report to Bengisu**

List: what changed on the site; the commits on `lamp-visuals` and in each other repo (none pushed); the beats from Task 8 Step 5 that still show recordings, for her to decide; anything from Step 2. Ask whether to push the showcase branch (and open a PR) and each repo's commit. After a push, watch the CI run and say it works only once it is green.
