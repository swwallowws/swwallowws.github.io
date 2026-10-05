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

  for (const theme of ids.length ? ["paper", "night"] : []) {
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
  if (ids.length) {
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

  // Silent cards (the welcome page's): a click plays the picture, never a sound.
  if (ids.length) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (e) => problems.push(`silent: script error: ${e.message}`));
    await page.addInitScript(() => {
      const Real = window.AudioContext;
      window.__audioMade = 0;
      window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__audioMade++; } };
    });
    await page.goto(gallery("silent=1"), { waitUntil: "networkidle" });
    for (const id of ids) {
      await page.locator(`#${id} canvas`).click();
      await page.waitForTimeout(400);
      if ((await data(page, id, "playing")) !== "1") problems.push(`silent: ${id} did not play its picture`);
    }
    const made = await page.evaluate(() => window.__audioMade);
    if (made) problems.push(`silent: ${made} audio context(s) made, expected none`);
    await page.close();
  }

  // Keys: Enter plays a focused card; Space is left alone, so it scrolls the page.
  if (ids.length) {
    const page = await open(`card=${ids[0]}`);
    await page.locator(`#${ids[0]} canvas`).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    if ((await data(page, ids[0], "playing")) !== "0") problems.push(`keys: Space played ${ids[0]}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    if ((await data(page, ids[0], "playing")) !== "1") problems.push(`keys: Enter did not play ${ids[0]}`);
    await page.close();
  }

  // Many clicks: a restless visitor clicks fast; the card keeps playing.
  if (ids.length) {
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
  if (ids.length) {
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
  if (ids.length) {
    const page = await open(`card=${ids[0]}&theme=paper`);
    const before = await pixel(page, ids[0]);
    await page.evaluate(() => { document.documentElement.dataset.theme = "night"; });
    await page.waitForTimeout(300);
    const after = await pixel(page, ids[0]);
    if (before.join() === after.join()) problems.push(`theme switch: ${ids[0]} kept its Paper colours in Night`);
    await page.close();
  }

  // A phone: nothing wider than the screen, and vertical swipes still scroll.
  if (ids.length) {
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
