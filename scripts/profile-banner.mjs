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
    const file = join(outDir, `map-${theme}.png`);
    await map.screenshot({ path: file });
    console.log(`banner ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
