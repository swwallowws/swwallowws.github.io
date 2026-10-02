// Export the swwallowws mark (glyphs.ts, homeMarkSvg) as logo files for
// partner pages and stores: the bare SVG, plus square PNGs with the mark
// centred on Paper and on Night.
//   node scripts/export-logo.mjs [size]   (default 1024; writes to brand/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const size = Number(process.argv[2] || 1024);
const out = new URL('../brand/', import.meta.url);
mkdirSync(out, { recursive: true });

// Kept in step with homeMarkSvg() in src/ui/glyphs.ts.
const d = 'M1.5,1.5 L4.5,1.5 L4.5,16.5 L1.5,22.5 Z M6,1.5 L9,1.5 L9,10.5 L6,13.5 Z '
  + 'M10.5,1.5 L13.5,1.5 L13.5,9 L12,7.5 L10.5,9 Z M15,1.5 L18,1.5 L18,13.5 L15,10.5 Z '
  + 'M19.5,1.5 L22.5,1.5 L22.5,22.5 L19.5,16.5 Z';
const svg = (ink) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${ink}" d="${d}"/></svg>`;

writeFileSync(new URL('swwallowws-mark.svg', out), svg('#111111') + '\n');

const themes = { paper: { ground: '#efeee9', ink: '#111111' }, night: { ground: '#0e0e0e', ink: '#f2f2ee' } };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: size, height: size } });
for (const [name, t] of Object.entries(themes)) {
  // The mark takes 60% of the square, so a store's rounded corners never touch it.
  await page.setContent(`<body style="margin:0;background:${t.ground};display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${size * 0.6}px;height:${size * 0.6}px">${svg(t.ink).replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await page.screenshot({ path: new URL(`swwallowws-logo-${name}-${size}.png`, out).pathname });
  console.log(`brand/swwallowws-logo-${name}-${size}.png`);
}
await browser.close();
console.log('brand/swwallowws-mark.svg');
