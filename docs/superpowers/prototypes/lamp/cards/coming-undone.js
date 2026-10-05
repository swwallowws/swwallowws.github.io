// Coming Undone: one song parts into its instruments, each written as notes.
{
  const PARTS = ['vocals', 'keys', 'bass', 'drums'], COL = ['snare', 'perc', 'hats', 'kick'], LANE = [.1, .36, .62, .88];
  const VOC = [0, 2, 4, 2, 5, 4, 2, 0], CH = [0, 3, 1, 4], BASS = [0, 0, 3, 3, 5, 5, 3, 3];
  const DR = new Set([0, 3, 4, 6, 8, 11, 12, 14]);
  const nearestPart = (s, y) => LANE.reduce((b, v, i) => Math.abs(s.V(v) - y) < Math.abs(s.V(LANE[b]) - y) ? i : b, 0);
  card({
    name: 'Coming Undone', category: 'transcribe', line: 'A song comes apart into its instruments, each written down as notes.',
    strings: 12,
    colour: k => COL[k % 4],
    base: () => .3,
    rest: (s, k, t, sec) => {
      const env = .55 + .45 * Math.sin(Math.PI * t);
      const w = .5 * Math.sin(t * 23 + sec * .5) + .3 * Math.sin(t * 57 + 1) + .2 * Math.sin(t * 131 + 2);
      return [s.U(t), s.V(.5 + .13 * w * env) + (k - 5.5) * 1.6 * env];
    },
    tight: (s, k, t) => {
      const part = k % 4, j = Math.floor(k / 4), lane = LANE[part];
      let v;
      if (part === 0) v = s.V(lane + .05 - VOC[Math.min(7, Math.floor(t * 8))] * .014) + (j - 1) * 1.2;
      else if (part === 1) v = s.V(lane + .05 - CH[Math.min(3, Math.floor(t * 4))] * .008 - j * .03);
      else if (part === 2) v = s.V(lane + .05 - BASS[Math.min(7, Math.floor(t * 8))] * .01) + (j - 1) * 1.2;
      else {
        const st = t * 16, near = st - Math.round(st), on = DR.has(Math.round(st) % 16);
        v = s.V(lane + .04) - (on ? Math.exp(-near * near * 60) : 0) * s.H * .08 + (j - 1) * 1.2;
      }
      return [s.U(t), v];
    },
    backdrop: (s, o) => {
      o.strokeStyle = rgba(s.C.line, 1); o.lineWidth = 1;
      LANE.forEach(v => { o.beginPath(); o.moveTo(0, s.V(v + .1)); o.lineTo(s.W, s.V(v + .1)); o.stroke(); });
    },
    label: (s, x, y) => `${PARTS[nearestPart(s, y)]} · written as notes`,
    playLabel: (s, p) => ({ text: 'one song · four parts', x: s.U(p) + 8, y: s.V(.0) }),
    audio: at => {
      const step = 3.2 / 8;
      [67, 69, 71, 69, 72, 71, 69, 67].forEach((m, i) => tone(m, at + i * step, step * .9, .07));
      [43, 43, 48, 48, 50, 50, 48, 48].forEach((m, i) => tone(m, at + i * step, step * .9, .1, 'sine'));
      [[60, 64, 67], [57, 60, 64], [62, 65, 69], [59, 62, 67]].forEach((c, i) => c.forEach(m => tone(m, at + i * 3.2 / 4, .7, .03, 'sine')));
      for (let i = 0; i < 16; i++) {
        const when = at + i * .2;
        if (i % 8 === 0 || i === 11) hit('kick', when);
        if (i % 8 === 4) hit('snare', when);
        if (i % 2 === 0) hit('hats', when);
      }
    },
  });
}
