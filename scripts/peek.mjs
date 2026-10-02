// Look at a page without a browser window: full-page screenshots in Paper and
// Night at desktop and phone width, into .peek/ (gitignored).
//   npm run peek                       (the local preview's welcome page)
//   npm run peek -- http://localhost:4180/session-notes/
//   npm run peek -- <url> "<css selector>"   (hover that element first)

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:4180/";
const hover = process.argv[3];
const dir = fileURLToPath(new URL("../.peek", import.meta.url));
mkdirSync(dir, { recursive: true });
const slug = new URL(url).pathname.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
const SIZES = { desktop: [1440, 900], phone: [390, 844] };

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const theme of ["paper", "night"]) {
    for (const [size, [width, height]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width, height } });
      const u = new URL(url);
      u.searchParams.set("theme", theme);
      await page.goto(u.toString(), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      // Scroll through once so lazy images load, as they would for a reader.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        scrollTo(0, 0);
      });
      await page.waitForLoadState("networkidle");
      if (hover) {
        await page.hover(hover);
        await page.waitForTimeout(300); // let hover transitions finish
      }
      const file = join(dir, `${slug}${hover ? "-hover" : ""}-${size}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
