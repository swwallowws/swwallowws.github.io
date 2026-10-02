// Prints a CV layout (an HTML file, its fonts beside it) to an A4 PDF next to it.
// The CV's source lives in the vault (CV & Portfolio/CV drafts/source/); this
// script lives here because it uses the showcase's headless Chrome tooling.
//   node scripts/print-cv.mjs "<path>/CV 2026 - E.html"   -> "<path>/../CV 2026 - E.pdf"
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/print-cv.mjs "<cv>.html" [out.pdf]'); process.exit(2); }
const out = process.argv[3] ?? join(dirname(src), "..", basename(src).replace(/\.html$/, ".pdf"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(src).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`wrote ${out}`);
