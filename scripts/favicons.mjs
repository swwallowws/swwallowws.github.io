// Regenerates every favicon, so a symbol change is one command:
//   npm run favicons                  public/favicons/<id>.svg, -32.png, -180.png
//   npm run favicons -- --copy        ...and copy each tool's set into its own repo
//   npm run favicons -- --sheet       ...and a contact sheet at .peek/favicons-sheet.png
//   npm run favicons -- --verify <url> [<url> ...]
//                                     open pages, check every icon link loads
//
// The symbols come from src/ui/glyphs.ts (faviconSymbol), the colours from the
// design tokens (vendor/design/tokens.css): each page's category accent, or
// ink for the welcome page, which has no category. Which category a page has
// comes from visuals/cards.json, the same list the social cards use.
//
// Each SVG carries both schemes: Paper colours by default, Night under
// `@media (prefers-color-scheme: dark)`. The PNGs are fallbacks rendered from
// the same markup in the installed Chrome: a transparent 32 px tab icon in
// Paper colours, and a 180 px apple-touch-icon on the Paper ground (iOS
// needs an opaque square). No favicon.ico: every <head> links the PNG.
//
// --copy writes favicon.svg, favicon-32.png and apple-touch-icon.png into each
// tool's own static folder (COPY below); those repos link them from their
// pages and commit the copies, so rerun --copy after a symbol change.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const outDir = join(root, "public/favicons");
const peekDir = join(root, ".peek/favicons");
const { faviconSymbol } = await import(pathToFileURL(join(root, "src/ui/glyphs.ts")).href);

// Page id -> its tool's static folder in the sibling repo (from this root).
const COPY = {
  ysad: "../yousuckatdrums/demo/favicons",
  voxmpe: "../voxmpe/studio-ui/favicons",
  tabridge: "../tabridge/web/favicons",
  "session-notes": "../ableton-session-notes/demo/favicons",
  stemscribe: "../stemscribe/src/stemscribe/web/static/favicons",
  rearranged: "../rearranged/src/rearranged/web/favicons",
};

// ---- colours from the tokens ------------------------------------------------
const tokens = readFileSync(join(root, "vendor/design/tokens.css"), "utf8");
const pair = (re) => {
  const m = tokens.match(re);
  if (!m) throw new Error(`tokens.css: no match for ${re}`);
  return { paper: m[1], night: m[2] };
};
const INK = pair(/--ink:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);
const GROUND = pair(/--ground:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);
const ACCENTS = Object.fromEntries(
  [...tokens.matchAll(/\[data-category="(\w+)"\]\s*\{\s*--acc:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)].map((m) => [
    m[1],
    { paper: m[2], night: m[3] },
  ]),
);

const cards = JSON.parse(readFileSync(join(root, "visuals/cards.json"), "utf8")).cards;
const PAGES = cards.map((c) => ({ id: c.id, name: c.name, colour: c.category ? ACCENTS[c.category] : INK }));

// ---- markup -------------------------------------------------------------------
const withStyle = (svg, css) => svg.replace(/^<svg([^>]*)>/, `<svg$1><style>${css}</style>`);
const sized = (svg, px) => svg.replace(/^<svg /, `<svg width='${px}' height='${px}' `);

/** The favicon as shipped: both schemes. */
const schemeSvg = (id, colour) =>
  withStyle(faviconSymbol(id), `svg{color:${colour.paper}}@media (prefers-color-scheme:dark){svg{color:${colour.night}}}`);
/** One scheme only, for the PNGs and the contact sheet. */
const fixedSvg = (id, hex) => withStyle(faviconSymbol(id), `svg{color:${hex}}`);

async function render(browser, svg, px, file, { box = px, bg } = {}) {
  const page = await browser.newPage({ viewport: { width: box, height: box }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<html><body style="margin:0;background:${bg ?? "transparent"}"><div style="width:${box}px;height:${box}px;display:grid;place-items:center">${sized(svg, px)}</div></body></html>`,
    );
    await page.screenshot({ path: file, omitBackground: !bg });
  } finally {
    await page.close();
  }
}

// ---- 1. generate --------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const { id, colour } of PAGES) {
    if (!faviconSymbol(id)) throw new Error(`no favicon symbol for ${id}`);
    writeFileSync(join(outDir, `${id}.svg`), schemeSvg(id, colour) + "\n");
    await render(browser, fixedSvg(id, colour.paper), 32, join(outDir, `${id}-32.png`));
    // iOS masks the corners itself; keep the glyph well inside.
    await render(browser, fixedSvg(id, colour.paper), 112, join(outDir, `${id}-180.png`), { box: 180, bg: GROUND.paper });
    console.log(`icon   favicons/${id}.svg, ${id}-32.png, ${id}-180.png`);
  }

  // ---- 2. copy into the tools' repos -------------------------------------------
  if (args.includes("--copy")) {
    for (const [id, rel] of Object.entries(COPY)) {
      const dir = join(root, rel);
      mkdirSync(dir, { recursive: true });
      copyFileSync(join(outDir, `${id}.svg`), join(dir, "favicon.svg"));
      copyFileSync(join(outDir, `${id}-32.png`), join(dir, "favicon-32.png"));
      copyFileSync(join(outDir, `${id}-180.png`), join(dir, "apple-touch-icon.png"));
      console.log(`copy   ${id} -> ${rel}/`);
    }
  }

  // ---- 3. contact sheet ----------------------------------------------------------
  if (args.includes("--sheet")) {
    mkdirSync(peekDir, { recursive: true });
    const rows = [];
    for (const { id, name, colour } of PAGES) {
      const cells = [];
      for (const scheme of ["paper", "night"]) {
        for (const px of [16, 32]) {
          await render(browser, fixedSvg(id, colour[scheme]), px, join(peekDir, `${id}-${scheme}-${px}.png`));
        }
        const f = (px) => `${id}-${scheme}-${px}.png`;
        cells.push(
          `<td class="${scheme}"><img src="${f(16)}" width="16"> <img class="px" src="${f(16)}" width="96"> ` +
            `<img src="${f(32)}" width="32"> <img class="px" src="${f(32)}" width="96"> ` +
            // As an image: inline, every SVG's <style> would leak into the others.
            `<img src="data:image/svg+xml,${encodeURIComponent(fixedSvg(id, colour[scheme]))}" width="180"></td>`,
        );
      }
      rows.push(`<tr><th>${name}</th>${cells.join("")}<td><img src="../../public/favicons/${id}-180.png" width="180"></td></tr>`);
    }
    const html = `<!doctype html><meta charset="utf-8"><style>
      body { margin: 0; font: 13px ui-monospace, monospace; background: #fff; }
      table { border-collapse: collapse; }
      th { text-align: left; padding: 0 16px; }
      td { padding: 12px 16px; }
      td > * { vertical-align: middle; margin-right: 12px; }
      .paper { background: ${GROUND.paper}; } .night { background: ${GROUND.night}; }
      .px { image-rendering: pixelated; }
      </style><table><tr><th></th><th>Paper: 16, 16 x6, 32, 32 x3, 180</th><th>Night: same</th><th>apple-touch-icon</th></tr>${rows.join("")}</table>`;
    const sheetHtml = join(peekDir, "sheet.html");
    writeFileSync(sheetHtml, html);
    const page = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(sheetHtml).href);
    const sheet = join(root, ".peek/favicons-sheet.png");
    await page.screenshot({ path: sheet, fullPage: true });
    await page.close();
    console.log(`sheet  ${sheet}`);
  }

  // ---- 4. verify pages -------------------------------------------------------------
  const vi = args.indexOf("--verify");
  if (vi >= 0) {
    let bad = 0;
    for (const url of args.slice(vi + 1).filter((a) => !a.startsWith("--"))) {
      const page = await browser.newPage();
      const failed = [];
      page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
      await page.goto(url, { waitUntil: "networkidle" });
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => l.href),
      );
      const results = [];
      for (const href of links) {
        const r = await page.request.get(href);
        results.push(`${r.status()} ${new URL(href).pathname} (${r.headers()["content-type"] ?? "?"})`);
        if (!r.ok()) bad++;
      }
      if (!links.length) bad++;
      bad += failed.length;
      console.log(`verify ${url}\n  ${links.length ? results.join("\n  ") : "NO ICON LINKS"}${failed.length ? `\n  failed requests:\n  ${failed.join("\n  ")}` : ""}`);
      await page.close();
    }
    if (bad) process.exitCode = 1;
  }
} finally {
  await browser.close();
}
