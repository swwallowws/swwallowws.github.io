// Moving pictures of the browser-based tools, for each project's repo (media/,
// linked from its README; the showcase itself shows lamp cards): a short,
// silent loop of the product (or its demo, where that reads better: Starling)
// doing one meaningful thing, in Paper and Night, like YSAD's (made from its plugin by
// yousuckatdrums/m4l/tools/make-loop.sh).
//   node scripts/loops.mjs            (every loop in visuals/loops.json)
//   node scripts/loops.mjs voxmpe     (one project)
//
// Each recipe in visuals/loops.json: `url` (the product, served locally or live),
// `site` (the live site it stands for: its version.json is kept in
// visuals/sources.json, so CI notices when the product moves on),
// `viewport`, `inject` (CSS that hides chrome), `setup` (actions that load
// content, not kept in the loop) and `show` (actions that are the loop). The
// `show` part is recorded with Chrome's own screencast (timestamped frames, no
// extra download), then encoded with the system ffmpeg to
// .local-visuals/<project>/loop-<theme>.mp4 (gitignored; copied by hand into the
// project's repo, media/) (H.264, 720 px wide, silent, fast
// start) with loop-<theme>.png, its first frame (or the one at `poster`
// seconds, when the loop starts empty), for readers who ask for reduced motion
// and while the video loads.
//
// Actions are those of visuals/manifest.json (click, fill, press, select,
// upload, hover, focus, blur, inject, scrollTo, waitFor, wait), plus
// {"slide": selector, "to": value, "ms": duration}, which moves a range input
// to `to` over `ms`, as a hand would, and {"mark": true}, which starts the clip.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { recordSource } from "./sources.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const recipes = JSON.parse(readFileSync(join(root, "visuals/loops.json"), "utf8")).loops;
const only = process.argv[2];
const THEMES = ["paper", "night"];
const tmp = join(root, ".peek/loops");

async function act(page, a) {
  // {"click": sel, "ifEnabled": true}: skip it when the control is disabled (it has
  // nothing to do, e.g. Rearranged's "make a cover" when the song already matches).
  if (a.click && a.ifEnabled && await page.isDisabled(a.click)) return;
  if (a.click) await page.click(a.click, a.force ? { force: true } : {});
  else if (a.fill) await page.fill(a.fill, a.text ?? "");
  else if (a.press) await page.keyboard.press(a.press);
  else if (a.select) await page.selectOption(a.select, a.value);
  else if (a.upload) await page.setInputFiles(a.upload, [a.file].flat().map((f) => join(root, f)));
  else if (a.hover) await page.hover(a.hover);
  else if (a.focus) await page.focus(a.focus);
  else if (a.blur) await page.evaluate(() => document.activeElement?.blur());
  else if (a.inject) await page.addStyleTag({ content: [a.inject].flat().join("\n") });
  else if (a.scrollTo !== undefined) await page.evaluate((y) => window.scrollTo(0, y), a.scrollTo);
  else if (a.waitFor) await page.waitForSelector(a.waitFor, { state: a.state ?? "visible", timeout: a.timeout ?? 15000 });
  else if (a.wait) await page.waitForTimeout(a.wait);
  else if (a.slide) {
    const steps = Math.max(1, Math.round((a.ms ?? 1500) / 50));
    const from = Number(await page.inputValue(a.slide));
    for (let i = 1; i <= steps; i++) {
      const v = from + ((Number(a.to) - from) * i) / steps;
      await page.evaluate(([sel, val]) => {
        const el = document.querySelector(sel);
        el.value = String(val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, [a.slide, v]);
      await page.waitForTimeout(50);
    }
  }
}

const problems = [];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
try {
  for (const r of recipes.filter((x) => !only || x.project === only)) {
    for (const theme of THEMES) {
      const [width, height] = r.viewport ?? [960, 600];
      const dir = join(tmp, `${r.project}-${theme}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        colorScheme: theme === "night" ? "dark" : "light",
      });
      const page = await context.newPage();
      const frames = []; // { file, t } with t in seconds (Chrome's timestamps)
      let ok = true;
      try {
        const url = new URL(r.url);
        url.searchParams.set("theme", theme);
        await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        const css = [r.inject ?? []].flat().join("\n");
        if (css) await page.addStyleTag({ content: css });
        for (const a of r.setup ?? []) await act(page, a);
        await page.waitForTimeout(300);
        // A still of where the show starts, for checking a recipe (.peek/loops/<project>-<theme>/setup.png).
        await page.screenshot({ path: join(dir, "setup.png"), fullPage: true });
        // Record the show: every painted frame, with its time.
        const cdp = await context.newCDPSession(page);
        cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
          const file = join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
          writeFileSync(file, Buffer.from(data, "base64"));
          frames.push({ file, t: metadata.timestamp });
          cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
        });
        await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width * 2, maxHeight: height * 2 });
        for (const a of r.show ?? []) await act(page, a);
        await cdp.send("Page.stopScreencast");
      } catch (e) {
        ok = false;
        problems.push(`${r.project} (${theme}): ${e.message.split("\n")[0]} (see ${join(dir, "fail.png")})`);
        await page.screenshot({ path: join(dir, "fail.png"), fullPage: true }).catch(() => {});
      }
      await context.close();
      if (!ok || frames.length < 2) {
        if (ok) problems.push(`${r.project} (${theme}): no frames recorded`);
        continue;
      }
      // Frames arrive only when something changes: give each one the time
      // until the next, so stills hold as long as they did on screen.
      const list = frames.map((f, i) => {
        const next = frames[i + 1]?.t ?? f.t + 0.5;
        return `file '${f.file}'\nduration ${Math.max(0.01, next - f.t).toFixed(3)}`;
      });
      list.push(`file '${frames.at(-1).file}'`);
      const listFile = join(dir, "frames.txt");
      writeFileSync(listFile, list.join("\n") + "\n");
      const out = join(root, ".local-visuals", r.project);
      mkdirSync(out, { recursive: true });
      const mp4 = join(out, `loop-${theme}.mp4`);
      const png = join(out, `loop-${theme}.png`);
      const crop = r.crop ? `crop=${r.crop},` : "";
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
        "-vf", `${crop}scale=720:-2,fps=30`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow",
        "-movflags", "+faststart", "-an", mp4]);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(r.poster ?? 0), "-i", mp4, "-frames:v", "1", png]);
      const secs = frames.at(-1).t - frames[0].t;
      console.log(`loop   ${r.project}/loop-${theme}.mp4 (${secs.toFixed(1)} s, ${frames.length} frames)`);
    }
    // Which live build this loop shows (scripts/check-visuals.mjs compares it later).
    // Record from a local server only once its build is the one deployed.
    if (r.site && !problems.some((p) => p.startsWith(`${r.project} `))) {
      try {
        const s = await recordSource(`${r.project}/loop`, r.site);
        console.log(`source ${r.project}/loop: ${r.site} build ${s.commit.slice(0, 7)}`);
      } catch (e) { problems.push(`${r.project}: could not read ${r.site}version.json (${e.message})`); }
    }
  }
} finally {
  await browser.close();
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
}
