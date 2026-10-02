// The GitHub profile's picture (swwallowws/swwallowws): the welcome page's map at
// rest, in Paper and Night, so the profile README can show the one that matches
// the visitor's theme. Re-run after the map changes.
//   node scripts/profile-banner.mjs <out-dir> [site-url]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [outDir, site = "https://swwallowws.github.io/"] = process.argv.slice(2);
if (!outDir) { console.error("usage: node scripts/profile-banner.mjs <out-dir> [site-url]"); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const theme of ["paper", "night"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme === "night" ? "dark" : "light" });
    await page.goto(site, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const map = page.locator(".map");
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500); // the map settles after it comes into view
    // Everything named at once: every symbol's caption, every curve's tool, curves at full strength.
    await page.addStyleTag({ content: [
      ".map .node .cap, .map .edge .lbl, .map .ring-name { opacity: 1 !important; transition: none !important; }",
      ".map .edge .line, .map .edge .end { opacity: .85 !important; transition: none !important; }",
      ".map .node, .map .graph .node.lane { opacity: 1 !important; }",
    ].join("\n") });
    // With every name showing, a few captions under their symbol run into the next
    // symbol (or the lane line, or YSAD's loop): those sit beside their symbol here.
    await page.evaluate(() => {
      const beside = { "singing": "left", "a style": "left", "knobs": "left", "a drum pattern": "right" };
      for (const g of document.querySelectorAll(".map .node")) {
        const name = (g.getAttribute("aria-label") || "").split(":")[0];
        const side = beside[name];
        const cap = g.querySelector(".cap"), ring = g.querySelector(".ring");
        if (!side || !cap || !ring) continue;
        const r = Number(ring.getAttribute("r"));
        cap.setAttribute("x", String(side === "left" ? -(r + 9) : r + 9));
        cap.setAttribute("y", "4.5");
        cap.setAttribute("text-anchor", side === "left" ? "end" : "start");
      }
      // Two tool names nudged off their curves.
      for (const t of document.querySelectorAll(".map .edge .lbl")) {
        if (t.textContent === "Coming Undone") t.style.transform = "translate(-26px, -20px)";
        if (t.textContent === "Odoroki, coming") t.style.transform = "translate(14px, -4px)";
      }
    });
    await page.waitForTimeout(300);
    const file = join(outDir, `map-${theme}.png`);
    // Cropped to the drawing itself (names included), with a margin.
    const box = await page.evaluate(() => {
      const r = document.querySelector(".map .graph").getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
    });
    const pad = 32;
    await page.screenshot({ path: file, fullPage: true,
      clip: { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 } });
    console.log(`banner ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
