// Ready Set: a lead sheet becomes a band in Ableton Live to jam with. Chord
// symbols over a staff; under the lamp the staff's five lines become the
// set's tracks (chords, bass, drums), with your part left open.
{
  const X0 = .02, X1 = .98, BARS = 4;
  const barX = (s, b) => s.U(X0 + (X1 - X0) * b / BARS);
  const CHORDS = ['Am', 'F', 'C', 'G'];
  const ROLE = ['you', 'chords', 'chords', 'bass', 'drums'];
  const LANE = { you: [.1, .3], chords: [.35, .56], bass: [.61, .78], drums: [.83, 1] };
  const mid = r => (LANE[r][0] + LANE[r][1]) / 2;
  const staffY = (s, k) => s.V(.4) + k * s.H * .07;
  const CH = [0, -1, 1, -.5], BASS = [0, 0, -2, -2, 1, 1, -1, -1], DR = new Set([0, 4, 6, 8, 12, 14]);
  const t2 = t => clamp((t - X0) / (X1 - X0), 0, 1);

  card({
    name: 'Ready Set', category: 'transform',
    line: 'A score or a tab becomes a band in Ableton Live, in the key you pick. Your part stays open: sing it, play it, or make up your own.',
    strings: 5,
    points: 320,
    base: k => k === 0 ? .7 : .5,
    colour: k => k === 0 ? 'mut' : 'acc',
    rest: (s, k, t, sec) => [s.U(t), staffY(s, k) + Math.sin(t * 6 + sec * .7 + k) * .7],
    tight: (s, k, t) => {
      const role = ROLE[k], u = t2(t);
      if (role === 'you') return [s.U(t), s.V(mid('you'))];
      if (role === 'chords') return [s.U(t), s.V(mid('chords') + CH[Math.min(3, Math.floor(u * 4))] * .03) + (k === 1 ? -4 : 4)];
      if (role === 'bass') return [s.U(t), s.V(mid('bass') + BASS[Math.min(7, Math.floor(u * 8))] * .015)];
      const st = u * 16, near = st - Math.round(st), on = DR.has(Math.round(st) % 16);
      return [s.U(t), s.V(mid('drums') + .03) - (on ? Math.exp(-near * near * 60) : 0) * s.H * .045];
    },
    wander: (s, sec) => [s.U(.5 + .42 * Math.sin(sec * .3)), s.V(.42 + .2 * Math.sin(sec * .5))],
    // Underneath: the Ableton Live set. A bar ruler, a clip per track, and
    // your track left open (a dashed outline, nothing in it).
    backdrop: (s, o) => {
      const C = s.C;
      mono(o, 9);
      for (let b = 0; b < BARS; b++) {
        const x = barX(s, b);
        o.strokeStyle = rgba(C.line, 1); o.lineWidth = 1;
        o.beginPath(); o.moveTo(x, 2); o.lineTo(x, 12); o.stroke();
        o.fillStyle = rgba(C.mut, 1); o.fillText(String(b + 1), x + 3, 10);
      }
      const x0 = barX(s, 0) - 4, x1 = barX(s, BARS) + 4;
      for (const [role, [a, b]] of Object.entries(LANE)) {
        const y0 = s.V(a), y1 = s.V(b);
        o.textAlign = 'center';
        if (role === 'you') {
          o.setLineDash([4, 4]); o.strokeStyle = rgba(C.mut, 1);
          o.strokeRect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1); o.setLineDash([]);
          o.fillStyle = rgba(C.mut, 1); o.fillText('your part', (x0 + x1) / 2, y0 + 10);
        } else {
          o.fillStyle = rgba(C.ground, 1); o.fillRect(x0, y0, x1 - x0, y1 - y0);
          o.fillStyle = rgba(C.acc, 1); o.fillRect(x0, y0, x1 - x0, 12);
          o.strokeStyle = rgba(C.acc, 1); o.strokeRect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1);
          o.fillStyle = rgba(C.ground2, 1); o.fillText(role, (x0 + x1) / 2, y0 + 9);
        }
        o.textAlign = 'start';
      }
    },
    // Each chord symbol moves from the lead sheet down into the chords clip as
    // the set shows through, turning the accent colour on the way: one symbol,
    // never two.
    over: (s, ctx) => {
      ctx.font = '600 13px Archivo, sans-serif';
      CHORDS.forEach((c, b) => {
        const x = barX(s, b) + 4, y0 = staffY(s, 0) - 12, y1 = s.V(LANE.chords[1]) - 6;
        const lit = s.lit(x, y0 - 2, X0 + (X1 - X0) * b / BARS);
        const col = s.C.ink.map((v, j) => Math.round(v + (s.C.acc[j] - v) * lit));
        ctx.fillStyle = rgba(col, .9);
        ctx.fillText(c, x + 2 * lit, y0 + (y1 - y0) * lit);
      });
    },
    label: (s, x, y) => {
      const v = (y - 22) / (s.H - 44);
      const role = Object.entries(LANE).sort((a, b) => Math.abs(mid(a[0]) - v) - Math.abs(mid(b[0]) - v))[0][0];
      if (role === 'you') return 'your part · open: sing it, play it, or improvise';
      if (role === 'chords') return `chords · ${CHORDS[Math.min(3, Math.floor(t2(s.u(x)) * 4))]}`;
      return role === 'bass' ? 'bass' : 'drums';
    },
    playLabel: (s, p) => ({ text: 'the band plays · you jam', x: s.U(p) + 8, y: s.V(mid('you')) + 4 }),
    audio: at => {
      const bar = 3.2 / BARS;
      const triads = { Am: [57, 60, 64], F: [53, 57, 60], C: [55, 60, 64], G: [55, 59, 62] };
      CHORDS.forEach((c, b) => triads[c].forEach(m => tone(m, at + b * bar, bar * .95, .04, 'sine')));
      [45, 45, 41, 41, 48, 48, 43, 43].forEach((m, i) => tone(m, at + i * bar / 2, bar / 2 * .9, .11, 'sine'));
      for (let i = 0; i < 16; i++) {
        const when = at + i * 3.2 / 16;
        if (DR.has(i) && i % 4 !== 2) hit('kick', when);
        if (i % 8 === 4) hit('snare', when);
        if (i % 2 === 0) hit('hats', when, .6);
      }
    },
  });
}
