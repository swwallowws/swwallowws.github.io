// Print what a visitor reads on each page: the visible text (the DEMO watermark
// folded away), then the tooltips, aria-labels and placeholders. For content
// reviews (the Content walkthrough in the vault).
//   node scripts/page-text.mjs <url>...
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const url of process.argv.slice(2)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      console.log(`\n==== ${url}\n(load: ${e.message.split('\n')[0]})`);
    }
    await page.waitForTimeout(800);
    const got = await page.evaluate(() => {
      const text = document.body.innerText.replace(/(^DEMO\s*$\n?)+/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      const attrs = new Set();
      for (const e of document.querySelectorAll('body *')) {
        for (const a of ['title', 'aria-label', 'placeholder']) {
          const v = e.getAttribute(a);
          if (v) attrs.add(`[${a}] ${v}`);
        }
      }
      return { title: document.title, text, attrs: [...attrs] };
    });
    console.log(`\n==== ${url}  (${got.title})\n${got.text}\n-- labels\n${got.attrs.join('\n')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
