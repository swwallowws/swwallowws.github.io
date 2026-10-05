// Starling: a voice becomes notes, every slide kept.
{
  const NOTES = [
    { a: .03, b: .16, n: 60 }, { a: .20, b: .31, n: 64 }, { a: .35, b: .52, n: 62, v: 1 },
    { a: .56, b: .71, n: 67 }, { a: .75, b: .85, n: 65 }, { a: .88, b: .98, n: 64, v: 1 },
  ];
  const T0 = NOTES[0].a, T1 = NOTES.at(-1).b, LO = 55, HI = 71;
  const noteAt = t => NOTES.find(s => t >= s.a && t <= s.b) || null;
  const semi = t => {
    for (let i = 0; i < NOTES.length; i++) {
      const s = NOTES[i];
      if (t >= s.a && t <= s.b) {
        const p = (t - s.a) / (s.b - s.a), prev = i ? NOTES[i - 1].n : s.n - 1;
        const scoop = p < .18 ? (prev - s.n) * (1 - p / .18) ** 2 * .5 : 0;
        const vib = s.v ? Math.sin(p * 44) * .35 * Math.min(1, p * 3) : 0;
        return s.n + scoop + vib;
      }
      const next = NOTES[i + 1];
      if (next && t > s.b && t < next.a) { const q = (t - s.b) / (next.a - s.b); return s.n + (next.n - s.n) * q * q * (3 - 2 * q); }
    }
    return t < T0 ? NOTES[0].n : NOTES.at(-1).n;
  };
  const amp = t => { const s = noteAt(t); if (!s) return .35; const p = (t - s.a) / (s.b - s.a); return .45 + .55 * Math.sin(Math.PI * Math.min(1, p * 1.15 + .04)); };
  const u = t => T0 + (T1 - T0) * t;
  // What the voice is doing at a point: holding a note, or sliding between two.
  const say = x => {
    const nt = noteAt(x);
    if (nt) return nt.v ? `${nameOf(nt.n)} · vibrato kept` : nameOf(nt.n);
    const i = NOTES.findIndex(n => n.a > x);
    return i > 0 ? `slide ${nameOf(NOTES[i - 1].n)} → ${nameOf(NOTES[i].n)} · kept` : null;
  };
  card({
    name: 'Starling', category: 'transcribe', line: 'Simply sing. Your voice becomes notes, every slide kept.',
    strings: 9,
    rest: (s, k, t, sec) => { const x = u(t), a = amp(x); return [s.U(x), py(s, semi(x), LO, HI) + (k - 4) * a * 4.5 + Math.sin(x * 9 + sec * .7 + k * .8) * a * 1.5]; },
    tight: (s, k, t) => { const x = u(t), nt = noteAt(x); return [s.U(x), (nt ? py(s, nt.n, LO, HI) : py(s, semi(x), LO, HI)) + (k - 4) * .7]; },
    when: (k, t) => u(t),
    backdrop: (s, o) => {
      o.strokeStyle = rgba(s.C.line, 1); o.lineWidth = 1;
      for (let n = LO; n <= HI; n++) { const y = py(s, n, LO, HI); o.beginPath(); o.moveTo(0, y); o.lineTo(s.W, y); o.stroke(); }
      mono(o, 10); o.fillStyle = rgba(s.C.ink, 1);
      for (const nt of NOTES) o.fillText(nameOf(nt.n), s.U(nt.a), py(s, nt.n, LO, HI) - 9);
    },
    label: (s, x) => say(s.u(x)),
    playLabel: (s, p) => { const t = say(p); return t ? { text: t, x: s.U(p) + 8, y: s.V(.04) } : null; },
    audio: at => {
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; g.gain.setValueAtTime(0, at);
      for (let i = 0; i <= 160; i++) {
        const t = i / 160, when = at + t * 3.2;
        o.frequency.linearRampToValueAtTime(hz(semi(t)), when);
        g.gain.linearRampToValueAtTime(t < T0 || t > T1 ? 0 : .14 * amp(t), when);
      }
      o.connect(g).connect(a.destination); o.start(at); o.stop(at + 3.3);
    },
  });
}
