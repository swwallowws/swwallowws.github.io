// The lamp: shared engine for the strings prototypes.
// Each card is a bundle of strings at rest (the music as a musician knows it)
// and the same strings pulled tight (what the tool makes of it). The lamp, a
// soft light under the pointer, pulls the strings it touches tight and shows the
// backdrop beneath; clicking plays, and everything the playhead passes turns.
// Text lives only in the lamp (label) or rides with the playhead (playLabel).
//
// A page needs: tokens.css, a `.modes` theme switch (optional), a `#grid`, and
// then calls card({...}) per card and lampStart().

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = x => x * x * (3 - 2 * x);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nameOf = n => NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
const mono = (o, px) => { o.font = `${px}px "JetBrains Mono", monospace`; };
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
// A pitch's height in a card, between the lowest and highest pitch shown.
const py = (s, n, lo, hi) => s.V(1 - (n - lo) / (hi - lo));

// ---------- sound ----------
let AC, NOISE;
const ac = () => {
  AC ??= new AudioContext();
  if (!NOISE) {
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return AC;
};
const hz = m => 440 * 2 ** ((m - 69) / 12);
function tone(m, at, dur, gain = .1, type = 'triangle', bendTo = null) {
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(hz(m), at);
  if (bendTo != null) o.frequency.linearRampToValueAtTime(hz(bendTo), at + Math.min(.25, dur * .5));
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .01);
  g.gain.exponentialRampToValueAtTime(.0001, at + dur);
  o.connect(g).connect(a.destination); o.start(at); o.stop(at + dur + .05);
}
function hit(kind, at, gain = 1) {
  const a = ac(), g = a.createGain();
  if (kind === 'kick') {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(42, at + .14);
    g.gain.setValueAtTime(.5 * gain, at); g.gain.exponentialRampToValueAtTime(.001, at + .3);
    o.connect(g).connect(a.destination); o.start(at); o.stop(at + .32);
    return;
  }
  const n = a.createBufferSource(), f = a.createBiquadFilter();
  n.buffer = NOISE;
  f.type = kind === 'hats' ? 'highpass' : 'bandpass';
  f.frequency.value = kind === 'hats' ? 7000 : kind === 'snare' ? 1800 : 900;
  const len = kind === 'hats' ? .05 : kind === 'snare' ? .18 : .1;
  g.gain.setValueAtTime((kind === 'hats' ? .12 : .3) * gain, at); g.gain.exponentialRampToValueAtTime(.001, at + len);
  n.connect(f).connect(g).connect(a.destination); n.start(at); n.stop(at + len + .02);
}

// ---------- the engine ----------
const POINTS = 160, LEVELS = 8, PAD = 22;
const cards = [];

function card(def) {
  const el = document.createElement('div');
  el.className = 'opt'; el.dataset.category = def.category;
  el.innerHTML = `<canvas></canvas><div class="meta"><div class="letter">${def.tag ?? def.category}</div><h3>${def.name}</h3><p>${def.line}</p></div><span class="probe"></span>`;
  document.getElementById('grid').append(el);
  const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
  const off = document.createElement('canvas'), octx = off.getContext('2d');
  const s = { def, el, canvas, ctx, off, octx, W: 0, H: 0, x: 0, y: 0, lx: 0, ly: 0, last: -1e9, inside: false,
              playStart: -1, playEnd: -1, visible: true, C: {}, seed: cards.length * 1.7 };
  s.U = u => PAD + u * (s.W - 2 * PAD);
  s.V = v => PAD + v * (s.H - 2 * PAD);
  s.u = x => (x - PAD) / (s.W - 2 * PAD);
  const size = () => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    for (const c of [canvas, off]) { c.width = r.width * d; c.height = r.height * d; }
    ctx.setTransform(d, 0, 0, d, 0, 0); octx.setTransform(d, 0, 0, d, 0, 0);
    s.W = r.width; s.H = r.height;
    [s.lx, s.ly] = wander(s, 0);
  };
  new ResizeObserver(size).observe(canvas); size();
  new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; }).observe(canvas);
  const at = e => { const r = canvas.getBoundingClientRect(); s.x = e.clientX - r.left; s.y = e.clientY - r.top; s.last = performance.now(); s.inside = true; };
  canvas.addEventListener('pointermove', at);
  canvas.addEventListener('pointerdown', e => {
    at(e); canvas.setPointerCapture(e.pointerId);
    const now = ac().currentTime + .06;
    def.audio?.(now, s); // s.x, s.y: where the click landed, for cards that care
    s.playStart = performance.now() + 60; s.playEnd = s.playStart + (def.dur ?? 3.2) * 1000;
  });
  canvas.addEventListener('pointerleave', () => { s.inside = false; });
  canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') s.inside = false; });
  cards.push(s);
  readColours(s);
  return s;
}

function readColours(s) {
  const probe = s.el.querySelector('.probe');
  for (const [k, v] of Object.entries({ ground: '--ground', ground2: '--ground-2', ink: '--ink', mut: '--ink-mut', line: '--line', acc: '--acc',
                                        kick: '--drum-kick', snare: '--drum-snare', hats: '--drum-hats', perc: '--drum-perc' })) {
    probe.style.color = `var(${v})`;
    s.C[k] = getComputedStyle(probe).color.match(/\d+/g).slice(0, 3).map(Number);
  }
}

function wander(s, sec) {
  if (s.def.wander) return s.def.wander(s, sec);
  const t = .5 + .4 * Math.sin(sec * .3 + s.seed);
  return s.def.rest(s, Math.floor(s.def.strings / 2), t, sec);
}

// The backdrop shows through the lamp, and across everything the playhead has passed.
function light(s, r, sweep, fade) {
  const { octx: o, W, H, def } = s;
  if (!def.backdrop) return;
  const pass = mask => {
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    def.backdrop(s, o);
    o.globalCompositeOperation = 'destination-in';
    mask();
    s.ctx.drawImage(s.off, 0, 0, W, H);
  };
  pass(() => {
    const g = o.createRadialGradient(s.lx, s.ly, r * .4, s.lx, s.ly, r * 1.1);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g; o.fillRect(0, 0, W, H);
  });
  if (sweep >= 0 && fade > 0) {
    pass(() => {
      o.fillStyle = `rgba(0,0,0,${fade})`;
      if (def.sweepMask) def.sweepMask(s, o, sweep);
      else { o.beginPath(); o.rect(0, 0, (def.sweepX ?? ((s, p) => s.U(p)))(s, sweep), H); }
      o.fill();
    });
  }
}

// A small label with a ground behind it, kept inside the card.
function tag(s, text, x, y, colour) {
  const { ctx, W, H, C } = s;
  mono(ctx, 10);
  const tw = ctx.measureText(text).width;
  x = clamp(x, 4, W - tw - 8); y = clamp(y, 12, H - 6);
  ctx.fillStyle = rgba(C.ground2, .92); ctx.fillRect(x - 3, y - 10, tw + 6, 14);
  ctx.fillStyle = rgba(colour ?? C.ink, 1); ctx.fillText(text, x, y);
}

function draw(s, ms) {
  const { ctx, W, H, def, C } = s;
  const sec = still ? 0 : ms / 1000;
  const idle = !s.inside || ms - s.last > 2500;
  const [tx, ty] = idle ? wander(s, ms / 1000) : [s.x, s.y];
  const k = idle ? .04 : .25;
  s.lx += (tx - s.lx) * k; s.ly += (ty - s.ly) * k;
  const R = Math.min(180, W * .34);

  const dur = (def.dur ?? 3.2) * 1000;
  const p = s.playStart > 0 ? (ms - s.playStart) / dur : -1;
  const playing = p >= 0 && p <= 1;
  const relax = s.playStart > 0 && ms > s.playEnd ? clamp((ms - s.playEnd) / 1200, 0, 1) : 0;
  const sweep = s.playStart > 0 && ms >= s.playStart && relax < 1 ? clamp(p, 0, 1) : -1;
  const keep = 1 - smooth(relax);

  ctx.fillStyle = rgba(C.ground2, 1); ctx.fillRect(0, 0, W, H);
  s.wAt = (x, y) => smooth(clamp(1 - Math.hypot(x - s.lx, y - s.ly) / R, 0, 1));
  s.sweep = sweep; s.keep = keep; s.playing = playing; s.p = p; s.sec = sec;
  s.lit = (x, y, when) => Math.max(s.wAt(x, y), sweep >= 0 && when <= sweep ? keep : 0);
  def.surface?.(s, ctx, sec);
  light(s, R, sweep, keep);

  const mid = (def.strings - 1) / 2;
  const N = def.points ?? POINTS;
  for (let kk = 0; kk < def.strings; kk++) {
    const paths = Array.from({ length: LEVELS + 1 }, () => new Path2D());
    let prev = null;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const [rx, ry] = def.rest(s, kk, t, sec);
      const [tx2, ty2] = def.tight(s, kk, t, sec);
      let w = s.wAt(rx, ry);
      // A card can pull strings taut on its own too (YSAD's turning hand).
      if (def.lift) w = Math.max(w, def.lift(s, kk, t));
      if (sweep >= 0) {
        const when = def.when ? def.when(kk, t) : t;
        const behind = when <= sweep ? smooth(clamp((sweep - when) / .04, 0, 1)) : 0;
        w = Math.max(w, behind * keep);
      }
      const x = rx + (tx2 - rx) * w, y = ry + (ty2 - ry) * w;
      if (prev) {
        // How strongly this piece shows (colour and thickness): how taut it is,
        // unless the card shapes it (YSAD makes its hits more intense).
        const lv = Math.round(clamp(def.intensity ? def.intensity(s, kk, t, w) : w, 0, 1) * LEVELS);
        paths[lv].moveTo(prev[0], prev[1]); paths[lv].lineTo(x, y);
      }
      prev = [x, y];
    }
    const col = C[def.colour ? def.colour(kk) : 'acc'];
    const base = def.base ? def.base(kk) : (Math.abs(kk - mid) < .6 ? .7 : .3);
    for (let lv = 0; lv <= LEVELS; lv++) {
      const w = lv / LEVELS;
      const c = C.mut.map((m, j) => Math.round(m + (col[j] - m) * w));
      ctx.strokeStyle = rgba(c, base + (1 - base) * w * .9);
      ctx.lineWidth = 1 + w * (def.thick ?? .4);
      ctx.stroke(paths[lv]);
    }
  }
  def.over?.(s, ctx, sec);

  if (playing) {
    ctx.strokeStyle = rgba(C.acc, .55); ctx.lineWidth = 1;
    if (def.playhead) def.playhead(s, ctx, p);
    else {
      const x = (def.sweepX ?? ((s, p) => s.U(p)))(s, p);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    const pl = def.playLabel?.(s, p);
    if (pl) tag(s, pl.text, pl.x, pl.y, C.acc);
  } else if (def.label) {
    // The lamp names what it is over, beside the pointer.
    const lb = def.label(s, s.lx, s.ly);
    if (lb) tag(s, lb, s.lx + R * .45, s.ly - R * .45);
  }
}

function frame(ms) {
  for (const s of cards) if (s.visible) draw(s, ms);
  requestAnimationFrame(frame);
}

function lampStart() {
  for (const b of document.querySelectorAll('.modes button')) {
    b.addEventListener('click', () => {
      document.documentElement.dataset.theme = b.dataset.mode;
      for (const o of document.querySelectorAll('.modes button')) o.setAttribute('aria-pressed', String(o === b));
      for (const s of cards) readColours(s);
    });
  }
  document.documentElement.dataset.theme = 'paper';
  for (const s of cards) readColours(s);
  requestAnimationFrame(frame);
}
