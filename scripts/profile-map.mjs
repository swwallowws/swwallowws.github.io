// The map for the GitHub profile README (swwallowws-profile/assets/map-<theme>.png):
// the live welcome page's landscape map, held flat (reduced motion), Paper and Night,
// at twice its size so it stays sharp.
//   node scripts/profile-map.mjs <out dir>
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const out = resolve(process.argv[2] ?? ".local-visuals/profile");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const theme of ["paper", "night"]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce",
    colorScheme: theme === "night" ? "dark" : "light",
  });
  await page.goto(`https://swwallowws.github.io/?theme=${theme}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const map = page.locator(".map").first();
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await map.screenshot({ path: join(out, `map-${theme}.png`) });
  console.log(join(out, `map-${theme}.png`));
  await page.close();
}
await browser.close();
