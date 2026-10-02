// Export YSAD's logo files for its store page, into yousuckatdrums/docs/brand/:
//   - the icon: the demo favicon's eight-step circle (demo/favicons/favicon.svg),
//     square, on Paper and on Night, plus its SVG;
//   - the wordmark: "YSAD" as the plugin window draws it (Archivo, weight 800,
//     width 125%, tracking -0.02em; gui/fonts.rs), ink on a transparent ground.
//   node scripts/export-ysad-logo.mjs [size]   (default 1024)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const size = Number(process.argv[2] || 1024);
const out = new URL('../../yousuckatdrums/docs/brand/', import.meta.url);
mkdirSync(out, { recursive: true });

// The circle, as in the favicon: big dots on steps 0, 3 and 6 (3+3+2), the
// rest small and faint.
const dots = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const a = (i / 8) * 2 * Math.PI;
  const big = i === 0 || i === 3 || i === 6;
  const x = (8 * Math.sin(a)).toFixed(2), y = (-8 * Math.cos(a)).toFixed(2);
  return `<circle cx="${x}" cy="${y}" r="${big ? 3.2 : 1.6}"${big ? '' : ' opacity="0.45"'}/>`;
}).join('');
const icon = (acc) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="${acc}">${dots}</svg>`;
writeFileSync(new URL('ysad-icon.svg', out), icon('#c23900') + '\n');

const themes = {
  paper: { ground: '#efeee9', ink: '#111111', acc: '#c23900' },
  night: { ground: '#0e0e0e', ink: '#f2f2ee', acc: '#ff5a1f' },
};
const font = readFileSync(new URL('../../design/fonts/Archivo.woff2', import.meta.url)).toString('base64');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size } });
for (const [name, t] of Object.entries(themes)) {
  // Icon: the circle takes 70% of the square, clear of a store's rounded corners.
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:${t.ground};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * 0.7}px;height:${size * 0.7}px">${icon(t.acc).replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await page.screenshot({ path: new URL(`ysad-icon-${name}-${size}.png`, out).pathname });
  console.log(`docs/brand/ysad-icon-${name}-${size}.png`);

  // Wordmark: set large, cropped to the letters with a small margin.
  await page.setContent(`<style>@font-face{font-family:A;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900;font-stretch:62% 125%}</style>
    <body style="margin:0;background:transparent"><span id="w" style="display:inline-block;padding:24px 32px;font:800 240px/1 A;font-stretch:125%;font-variation-settings:'wght' 800,'wdth' 125;letter-spacing:-0.02em;color:${t.ink}">YSAD</span></body>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#w').screenshot({ path: new URL(`ysad-wordmark-${name}.png`, out).pathname, omitBackground: true });
  console.log(`docs/brand/ysad-wordmark-${name}.png`);
}
await browser.close();
console.log('docs/brand/ysad-icon.svg');
