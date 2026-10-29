// Pick the pieces of a take by eye and ear: plays the recording in the browser,
// you mark ins and outs, and it hands back the segment list for a cut list.
//
//   node scripts/chop.mjs <video> [port] [--bar0 <s> --bar <s>]
//
// Then open http://localhost:<port>/ (default 8090). Keys: space play/pause,
// ← → a frame (shift: a second), [ ] a bar, i mark in, o mark out (adds the
// piece), backspace drops the last piece, c copies the list. With --bar0 and
// --bar, the timeline shows bar lines and marks snap to the nearest bar.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? Number(args.splice(i, 2)[1]) : null; };
const bar0 = flag('--bar0');
const bar = flag('--bar');
const [video, port = '8090'] = args;
if (!video) { console.error('usage: node scripts/chop.mjs <video> [port] [--bar0 <s> --bar <s>]'); process.exit(1); }
const size = statSync(video).size;

const page = `<!doctype html><meta charset="utf-8"><title>chop: ${basename(video)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #131018; color: #e8e4ee; font: 14px/1.4 ui-monospace, monospace; }
  main { max-width: 1400px; margin: 0 auto; padding: 16px; }
  video { width: 100%; max-height: 70vh; background: #000; display: block; }
  #line { position: relative; height: 44px; margin: 12px 0; background: #221d2b; cursor: pointer; }
  #line .bar { position: absolute; top: 0; bottom: 0; width: 1px; background: #3a3348; }
  #line .piece { position: absolute; top: 8px; bottom: 8px; background: #a993e8aa; }
  #line .in { position: absolute; top: 0; bottom: 0; width: 2px; background: #6fd3c4; }
  #line .head { position: absolute; top: 0; bottom: 0; width: 2px; background: #fff; }
  #now { font-size: 20px; }
  ol { padding-left: 20px; } li { margin: 2px 0; }
  .muted { color: #9a92a8; } button { font: inherit; }
</style>
<main>
  <video id="v" src="/video" preload="auto"></video>
  <div id="line"></div>
  <p><span id="now">0.00</span> <span class="muted" id="inat"></span></p>
  <p class="muted">space play · ← → frame (shift: second) · [ ] bar · i in · o out · backspace undo · c copy${bar ? ' · marks snap to bars' : ''}</p>
  <ol id="list"></ol>
  <button id="copy">copy segments</button> <span class="muted" id="copied"></span>
</main>
<script>
const BAR0 = ${bar0 ?? 'null'}, BAR = ${bar ?? 'null'};
const v = document.getElementById('v'), line = document.getElementById('line');
const pieces = []; let inAt = null;
const snap = (t) => BAR ? +(BAR0 + Math.round((t - BAR0) / BAR) * BAR).toFixed(3) : +t.toFixed(3);
const x = (t) => (t / v.duration) * 100 + '%';
function draw() {
  if (!v.duration) return;
  line.replaceChildren();
  if (BAR) for (let t = BAR0 - Math.floor(BAR0 / BAR) * BAR; t < v.duration; t += BAR) line.append(Object.assign(document.createElement('i'), { className: 'bar', style: 'left:' + x(t) }));
  for (const [a, b] of pieces) line.append(Object.assign(document.createElement('i'), { className: 'piece', style: 'left:' + x(a) + ';width:' + ((b - a) / v.duration * 100) + '%' }));
  if (inAt !== null) line.append(Object.assign(document.createElement('i'), { className: 'in', style: 'left:' + x(inAt) }));
  line.append(Object.assign(document.createElement('i'), { className: 'head', style: 'left:' + x(v.currentTime) }));
  document.getElementById('now').textContent = v.currentTime.toFixed(2) + ' / ' + v.duration.toFixed(2);
  document.getElementById('inat').textContent = inAt === null ? '' : 'in at ' + inAt;
  document.getElementById('list').replaceChildren(...pieces.map(([a, b]) => Object.assign(document.createElement('li'), { textContent: a + ' → ' + b + '  (' + (b - a).toFixed(2) + ' s)' })));
}
(function tick() { draw(); requestAnimationFrame(tick); })();
line.addEventListener('pointerdown', (e) => { const r = line.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * v.duration; });
const copy = () => { navigator.clipboard.writeText(JSON.stringify(pieces)); document.getElementById('copied').textContent = 'copied ' + JSON.stringify(pieces); };
document.getElementById('copy').onclick = copy;
addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 1 : 1 / 30;
  if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  else if (e.key === 'ArrowLeft') v.currentTime -= step;
  else if (e.key === 'ArrowRight') v.currentTime += step;
  else if (e.key === '[' && BAR) v.currentTime -= BAR;
  else if (e.key === ']' && BAR) v.currentTime += BAR;
  else if (e.key === 'i') inAt = snap(v.currentTime);
  else if (e.key === 'o' && inAt !== null) { const out = snap(v.currentTime); if (out > inAt) pieces.push([inAt, out]); inAt = null; }
  else if (e.key === 'Backspace') { e.preventDefault(); pieces.pop(); }
  else if (e.key === 'c') copy();
});
</script>`;

createServer((req, res) => {
  if (req.url !== '/video') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(page);
  }
  // ranges, so the browser can seek
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (!m) {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size, 'accept-ranges': 'bytes' });
    return createReadStream(video).pipe(res);
  }
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  res.writeHead(206, { 'content-type': 'video/mp4', 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
  createReadStream(video, { start, end }).pipe(res);
}).listen(Number(port), '127.0.0.1', () => console.log(`chop: http://localhost:${port}/  (${basename(video)})`));
