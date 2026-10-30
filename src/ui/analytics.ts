/* Counts the links out (a studio, MuseHub, GitHub) as GoatCounter events, so
   its dashboard shows where readers went from here as well as what they read.
   Page views count themselves (the script vite.config.ts adds to every page).
   Without that script, as in dev, this does nothing. */

type GoatCounter = { count(v: { path: string; title?: string; event?: boolean }): void };

function countOut(e: MouseEvent): void {
  if (e.type === 'auxclick' && e.button !== 1) return; // middle click opens a tab too
  const a = (e.target as Element | null)?.closest?.('a[href]');
  const gc = (window as { goatcounter?: GoatCounter }).goatcounter;
  if (!a || !gc?.count) return;
  const to = new URL(a.getAttribute('href') ?? '', location.href);
  if (to.origin === location.origin) return;
  gc.count({ path: `out: ${to.host}${to.pathname}`, title: (a.textContent ?? '').replace(/[↗→]/g, '').trim(), event: true });
}

export function countLinksOut(): void {
  document.addEventListener('click', countOut);
  document.addEventListener('auxclick', countOut);
}
