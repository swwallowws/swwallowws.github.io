// Regenerates every visual the site shows, so updating a project's visuals is
// one command:  npm run visuals            (everything)
//               npm run visuals session-notes   (one project)
//
// 1. Shots: each entry in visuals/manifest.json is opened in the installed
//    Chrome (headless, via playwright-core), put into the right state, and
//    captured in Paper and Night at 2x into public/visuals/<project>/.
// 2. Recordings: video files dropped in visuals/raw/<project>/ are encoded to
//    web-ready MP4 (H.264 + AAC, at most 1600 px wide, fast start) with a JPEG
//    poster, skipped when the output is already newer than the source.
// 3. Cards: each entry in visuals/cards.json is rendered through the design
//    system's visuals/card.html (thumb/og/square/story x Paper/Night) into
//    public/visuals/<id>/card-<format>-<theme>.png, for social previews.
// 4. Index: src/data/visuals.generated.ts lists what exists, and the site picks
//    thumbnails, video slots and card images from it. Never edit that file by hand.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { recordSource } from "./sources.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "visuals/manifest.json"), "utf8"));
// `npm run visuals -- <project>` does one project; `-- cards` only re-renders
// the cards and the index from the pictures already there (no servers needed).
const cardsOnly = process.argv[2] === "cards";
const only = cardsOnly ? undefined : process.argv[2];
const out = (project) => join(root, "public/visuals", project);
// Shots marked `local: true` (frozen demos on copyrighted test songs) are
// written outside public/, so Vite can never copy them into dist.
const localOut = (project) => join(root, ".local-visuals", project);
const THEMES = ["paper", "night"];
const VIDEO_EXT = new Set([".mov", ".mp4", ".m4v", ".webm", ".mkv"]);
const CARD_PORT = 4198;
// The pixel sizes per format come straight from the design system, so a
// change there (a new format, a resize) never needs mirroring here.
const cardJsPath = join(root, "vendor/design/visuals/card.js");
const { FORMATS: CARD_FORMATS } = existsSync(cardJsPath) ? await import(pathToFileURL(cardJsPath).href) : { FORMATS: {} };
// Every tool's symbol lives once, in src/ui/glyphs.ts (shared with the live
// map and the welcome page); Node reads TypeScript directly, so no build
// step is needed here.
const { cardSymbol } = await import(pathToFileURL(join(root, "src/ui/glyphs.ts")).href);

const log = (msg) => console.log(msg);
const problems = [];

// The shot stems a project's public/visuals/<project>/ directory holds: a
// name with both a Paper and a Night file, cards excluded.
function shotStems(files) {
  return [...new Set(files.filter((f) => f.endsWith("-paper.png") && !f.startsWith("card-")).map((f) => f.slice(0, -"-paper.png".length)))].filter(
    (n) => files.includes(`${n}-night.png`),
  );
}

// A project's thumb shot: the manifest names a shot `thumb: true`, and both
// its Paper and Night files exist. Used both for the welcome page's own
// visual (writeIndex()) and, here, for a card's image, so a shot only ever
// gets picked as "the thumb" in one place.
// A shot marked `local: true` (a frozen demo on a copyrighted test song) is
// gitignored, so it is never picked as a thumb: neither the committed index
// nor a committed card may point at a file a fresh clone does not have.
// A welcome-page loop's poster (loop-*.png, scripts/loops.mjs) wins when there
// is one: it is a frame of the same real product, re-recorded whenever the
// product changes, so the cards never lag behind the site.
function findThumb(project) {
  const dir = out(project);
  if (!existsSync(dir)) return undefined;
  const shots = shotStems(readdirSync(dir));
  if (shots.includes("loop")) return "loop";
  return manifest.shots.find((s) => s.project === project && s.thumb && !s.local && shots.includes(s.name))?.name;
}

// Shot names that stay local (see findThumb), left out of the index.
const localShots = (project) => new Set(manifest.shots.filter((s) => s.project === project && s.local).map((s) => s.name));

// ---- 1. shots -------------------------------------------------------------

// Staging a full product UI for a summary picture, all from the manifest:
// `inject` is CSS added to the page first (hide chrome, resize panels, zoom
// in, so the picture is full and composed rather than realistic), then
// `actions` run in order to load content. An {inject} action adds CSS at that
// point instead, for chrome that has to stay usable until then.
async function stage(page, shot) {
  const css = [shot.inject ?? []].flat().join("\n");
  if (css) await page.addStyleTag({ content: css });
  for (const a of shot.actions ?? []) {
    if (a.click) await page.click(a.click, a.force ? { force: true } : {});
    else if (a.fill) await page.fill(a.fill, a.text ?? "");
    else if (a.press) await page.keyboard.press(a.press);
    else if (a.select) await page.selectOption(a.select, a.value);
    else if (a.upload) await page.setInputFiles(a.upload, join(root, a.file));
    else if (a.hover) await page.hover(a.hover);
    else if (a.focus) await page.focus(a.focus);
    else if (a.blur) await page.evaluate(() => document.activeElement?.blur());
    else if (a.inject) await page.addStyleTag({ content: [a.inject].flat().join("\n") });
    else if (a.scrollTo !== undefined) await page.evaluate((y) => window.scrollTo(0, y), a.scrollTo);
    else if (a.waitFor) await page.waitForSelector(a.waitFor, { state: a.state ?? "visible", timeout: a.timeout ?? 15000 });
    else if (a.wait) await page.waitForTimeout(a.wait);
  }
}

async function captureShots() {
  const shots = manifest.shots.filter((s) => !only || s.project === only);
  if (!shots.length) return;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const shot of shots) {
      for (const theme of THEMES) {
        const url = new URL(shot.url);
        url.searchParams.set("theme", theme);
        const [width, height] = shot.viewport ?? [1280, 800];
        // The scheme too, for full product UIs that follow the system mode
        // and ignore ?theme=.
        const page = await browser.newPage({
          viewport: { width, height },
          deviceScaleFactor: 2,
          colorScheme: theme === "night" ? "dark" : "light",
        });
        const dir = shot.local ? localOut(shot.project) : out(shot.project);
        const file = join(dir, `${shot.name}-${theme}.png`);
        try {
          await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 15000 });
          await page.evaluate(() => document.fonts.ready);
          await stage(page, shot);
          await page.waitForTimeout(150); // let the last render settle
          mkdirSync(dir, { recursive: true });
          const target = shot.selector ? page.locator(shot.selector) : page;
          await target.screenshot({ path: file });
          log(`shot   ${shot.local ? ".local-visuals/" : ""}${shot.project}/${shot.name}-${theme}.png`);
          // Which live build this picture shows (scripts/check-visuals.mjs compares it later).
          if (shot.site && theme === THEMES.at(-1)) await recordSource(`${shot.project}/${shot.name}`, shot.site);
        } catch (e) {
          problems.push(`${shot.project}/${shot.name} (${theme}): ${e.message.split("\n")[0]} (is its demo server running? ${shot.url})`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

// ---- 2. recordings --------------------------------------------------------
function encodeRecordings() {
  const rawRoot = join(root, "visuals/raw");
  if (!existsSync(rawRoot)) return;
  for (const project of readdirSync(rawRoot)) {
    if (only && project !== only) continue;
    const dir = join(rawRoot, project);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!VIDEO_EXT.has(extname(f).toLowerCase())) continue;
      const src = join(dir, f);
      const name = basename(f, extname(f));
      mkdirSync(out(project), { recursive: true });
      const mp4 = join(out(project), `${name}.mp4`);
      const poster = join(out(project), `${name}.jpg`);
      if (existsSync(mp4) && statSync(mp4).mtimeMs > statSync(src).mtimeMs) continue;
      try {
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-t", String(manifest.maxVideoSeconds ?? 90),
          "-vf", "scale='min(1600,iw)':-2", "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", mp4]);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
        log(`video  ${project}/${name}.mp4 (+ poster)`);
      } catch (e) {
        problems.push(`${project}/${f}: ffmpeg failed: ${e.message.split("\n")[0]}`);
      }
    }
  }
}

// ---- 3. cards ---------------------------------------------------------------
async function captureCards() {
  const cardsPath = join(root, "visuals/cards.json");
  if (!existsSync(cardsPath)) return;
  const cardDefs = JSON.parse(readFileSync(cardsPath, "utf8")).cards.filter((c) => !only || c.id === only);
  const formats = Object.keys(CARD_FORMATS);
  if (!cardDefs.length || !formats.length) return;

  // Serve the whole project root, not just vendor/design: card.html's own
  // ../tokens.css / card.css / card.js imports resolve either way, and this
  // is also how a project's demo shot (public/visuals/<id>/...) reaches the
  // card as a same-origin <img>, which a file:// URL from an http:// page
  // cannot.
  const server = spawn("python3", ["-m", "http.server", String(CARD_PORT), "--directory", root], { stdio: "ignore" });
  try {
    await new Promise((resolve, reject) => {
      server.once("spawn", resolve);
      server.once("error", reject);
    });
    await new Promise((r) => setTimeout(r, 300)); // let the socket start accepting

    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      for (const def of cardDefs) {
        mkdirSync(out(def.id), { recursive: true });
        const symbol = cardSymbol(def.id);
        const thumb = findThumb(def.id);
        for (const format of formats) {
          const [width, height] = CARD_FORMATS[format];
          for (const theme of THEMES) {
            const data = {
              name: def.name,
              lines: def.lines,
              ...(symbol ? { symbol } : {}),
              ...(def.category ? { category: def.category } : {}),
              ...(def.focus ? { focus: def.focus } : {}),
              ...(thumb ? { image: `http://localhost:${CARD_PORT}/public/visuals/${def.id}/${thumb}-${theme}.png` } : {}),
            };
            const url = `http://localhost:${CARD_PORT}/vendor/design/visuals/card.html?format=${format}&theme=${theme}&data=${encodeURIComponent(JSON.stringify(data))}`;
            const file = join(out(def.id), `card-${format}-${theme}.png`);
            const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
            try {
              await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
              await page.waitForFunction(() => ["1", "error"].includes(document.body.dataset["ready"] ?? ""), { timeout: 15000 });
              if ((await page.evaluate(() => document.body.dataset["ready"])) === "error") {
                const msg = await page.evaluate(() => document.querySelector(".card-error")?.textContent ?? "card render error");
                problems.push(`card ${def.id}/${format}-${theme}: ${msg}`);
                continue;
              }
              await page.screenshot({ path: file });
              log(`card   ${def.id}/card-${format}-${theme}.png`);
            } catch (e) {
              problems.push(`card ${def.id}/${format}-${theme}: ${e.message.split("\n")[0]}`);
            } finally {
              await page.close();
            }
          }
        }
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

// ---- 4. index ---------------------------------------------------------------
function writeIndex() {
  const index = {};
  const pub = join(root, "public/visuals");
  const cardFormats = Object.keys(CARD_FORMATS);
  if (existsSync(pub)) {
    for (const project of readdirSync(pub).sort()) {
      const files = readdirSync(join(pub, project)).sort();
      const local = localShots(project);
      const shots = shotStems(files).filter((n) => !local.has(n));
      // The welcome page's silent loops (loop-*.mp4, scripts/loops.mjs) aren't a project's video.
      const videos = files.filter((f) => f.endsWith(".mp4") && !f.startsWith("loop-")).map((f) => f.slice(0, -4));
      const thumb = findThumb(project);
      const cards = Object.fromEntries(
        cardFormats
          .filter((f) => files.includes(`card-${f}-paper.png`) && files.includes(`card-${f}-night.png`))
          .map((f) => [f, `card-${f}`]),
      );
      index[project] = { shots, videos, ...(thumb ? { thumb } : {}), ...(Object.keys(cards).length ? { cards } : {}) };
    }
  }
  const body =
    "/* Generated by `npm run visuals` (scripts/visuals.mjs). Do not edit. */\n\n" +
    "export interface ProjectVisuals {\n  shots: string[];\n  videos: string[];\n  thumb?: string;\n" +
    "  /** File stems for the social cards, keyed by format; each is `<stem>-paper.png` / `<stem>-night.png`. */\n" +
    "  cards?: Partial<Record<'thumb' | 'og' | 'square' | 'story', string>>;\n}\n\n" +
    `export const VISUALS: Record<string, ProjectVisuals> = ${JSON.stringify(index, null, 2)};\n`;
  writeFileSync(join(root, "src/data/visuals.generated.ts"), body);
  log(`index  src/data/visuals.generated.ts (${Object.keys(index).length} projects)`);
}

if (!cardsOnly) {
  await captureShots();
  encodeRecordings();
}
await captureCards();
writeIndex();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
}
