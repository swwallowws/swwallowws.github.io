// Checks a served build of the site, page by page, before it goes public:
// every page loads without script errors, every file it asks this site for
// arrives (pictures, loops, fonts), and every link to another page of the site
// leads somewhere. Requests to other sites (the framed demos, GitHub) are
// listed apart, since they may not be live yet.
//   npm run preview -- --port 4180      (in another terminal)
//   node scripts/check-site.mjs http://localhost:4180/
//   node scripts/check-site.mjs http://localhost:4210/ "" try/   (another site: its pages)

import { chromium } from "playwright-core";

const base = new URL(process.argv[2] ?? "http://localhost:4180/");
const PAGES = process.argv.length > 3
  ? process.argv.slice(3)
  : ["", "ysad/", "rearranged/", "voxmpe/", "stemscribe/", "tabridge/", "session-notes/", "intentional/"];

// Project pages without a live demo, which show their lamp card instead.
const NO_DEMO = new Set(["intentional/"]);

const problems = [];
const elsewhere = new Map(); // other sites' URLs that failed, with the pages asking
const linked = new Set();
const demoErrors = new Set();
const probes = new Set();

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const theme of ["paper", "night"]) {
    for (const path of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const url = new URL(path, base);
      url.searchParams.set("theme", theme);
      const where = `${path || "/"} (${theme})`;
      // A framed demo's errors come from its own site: listed apart, fixed in its own repo.
      page.on("pageerror", (e) => {
        const from = (e.stack ?? "").match(/https?:\/\/[^/\s)]+/)?.[0];
        if (!from || from === base.origin) problems.push(`${where}: script error: ${e.message}`);
        else demoErrors.add(`${from}: ${e.message} (on ${path || "/"})`);
      });
      page.on("response", (r) => {
        if (r.status() < 400) return;
        const u = new URL(r.url());
        // A studio asks its own address for a local server's API (This computer); a static host says 404.
        // (under a subpath on GitHub Pages too: /rearranged-web/api/health)
        if (u.origin === base.origin && /\/(api|browser-models)\//.test(u.pathname)) probes.add(u.pathname);
        else if (u.origin === base.origin) problems.push(`${where}: ${r.status()} ${u.pathname}`);
        else elsewhere.set(r.url(), `${elsewhere.get(r.url()) ?? ""} ${path || "/"}`.trim());
      });
      page.on("requestfailed", (r) => {
        const u = new URL(r.url());
        if (/ERR_ABORTED/.test(r.failure()?.errorText ?? "")) return;
        if (u.origin === base.origin) problems.push(`${where}: failed ${u.pathname} (${r.failure()?.errorText})`);
        else elsewhere.set(r.url(), `${elsewhere.get(r.url()) ?? ""} ${path || "/"}`.trim());
      });
      await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30000 });
      // Scroll through, so lazy pictures and loops load as they would for a reader.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
      });
      await page.waitForLoadState("networkidle");
      // Something rendered (an embedded demo drops its heading, so any visible text counts).
      const text = await page.evaluate(() => document.body.innerText.trim().length);
      if (!text) problems.push(`${where}: nothing rendered`);
      // Loops that never got a frame: a video whose file is missing stays at readyState 0.
      const stuck = await page.evaluate(() =>
        [...document.querySelectorAll("video[src]")].filter((v) => v.readyState === 0).map((v) => v.getAttribute("src")),
      );
      for (const s of stuck) problems.push(`${where}: video never loaded: ${s}`);
      // A project page shows its lamp card only when it has no live demo (the
      // demo is the better picture): today, Tagline's alone.
      if (path) {
        const want = NO_DEMO.has(path) ? 1 : 0;
        const have = await page.locator(".lamp-wide canvas").count();
        if (have !== want) problems.push(`${where}: ${have} lamp cards, expected ${want}`);
      }
      // The welcome page shows every tool's lamp card (src/lamp/) and no
      // recordings marked "preview".
      if (!path) {
        const cards = await page.locator(".lamp-host canvas").count();
        if (cards !== 7) problems.push(`${where}: ${cards} lamp cards, expected 7`);
        if (await page.locator(".preview-tag").count()) problems.push(`${where}: a "preview" tag is still shown`);
        // The way in sits with the other buttons, one per tool.
        const tries = await page.locator(".actions .btn-try").count();
        if (tries !== 7) problems.push(`${where}: ${tries} "Try the demo" or "Read how it works" buttons beside the summaries, expected 7`);
        // The cards draw in the theme's colours: in Paper the ground is light.
        if (theme === "paper" && cards) {
          const [r, g, b] = await page.locator(".lamp-host canvas").first()
            .evaluate((c) => [...c.getContext("2d").getImageData(3, 3, 1, 1).data]);
          if (r + g + b < 3 * 160) problems.push(`${where}: a lamp card's ground is dark (${r}, ${g}, ${b}) in Paper`);
        }
      }
      // getAttribute: the map's links are SVG <a>, whose .href isn't a string
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].map((a) => new URL(a.getAttribute("href"), location.href).href),
      );
      for (const href of hrefs) {
        const u = new URL(href);
        if (u.origin === base.origin) linked.add(u.pathname);
      }
      await page.close();
    }
  }
  // Every link within the site: it must lead to a page.
  for (const p of linked) {
    const r = await fetch(new URL(p, base));
    if (r.status >= 400) problems.push(`link to ${p}: ${r.status}`);
  }
} finally {
  await browser.close();
}

console.log(`checked ${PAGES.length} pages in Paper and Night, ${linked.size} links within the site`);
if (elsewhere.size) {
  console.log(`\nother sites that didn't answer (fine if not deployed yet):`);
  for (const [u, pages] of elsewhere) console.log(`- ${u} (from ${[...new Set(pages.split(" "))].join(", ")})`);
}
if (probes.size) console.log(`\nlocal-server probes, 404 on a static host as expected: ${[...probes].join(", ")}`);
if (demoErrors.size) {
  console.log(`\nscript errors inside framed demos (fix in the demo's repo):\n- ${[...demoErrors].join("\n- ")}`);
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${[...new Set(problems)].join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("\nno problems");
}
