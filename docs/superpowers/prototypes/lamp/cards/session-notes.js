// Session Notes: lyric lines, each at its bar like clips stacked down an
// Ableton Live arrangement, pull taut into clips where they sit.
{
  const LYR = [{ bar: 1, text: 'low sun, high tide' }, { bar: 5, text: 'swallow whole the off-key hums' }, { bar: 9, text: 'then slowly fade from sight' }];
  const TL = (bar, f = 0) => (bar - 1) / 12 + f * 4 / 12 * .96;
  const rowY = (s, i) => s.V(.14 + i * .3);
  const lineAt = (s, y) => LYR.reduce((b, _, i) => Math.abs(rowY(s, i) + 12 - y) < Math.abs(rowY(s, b) + 12 - y) ? i : b, 0);
  card({
    name: 'Session Notes', category: 'workflow', line: 'Notes and lyrics, right inside Ableton Live.',
    strings: 9,
    base: k => k % 3 === 1 ? .6 : .3,
    rest: (s, k, t, sec) => {
      const i = Math.floor(k / 3), j = k % 3;
      return [s.U(TL(LYR[i].bar, t)), rowY(s, i) + 12 + Math.sin(t * 16 + i * 2 + j * .9 + sec * .6) * 3 + (j - 1) * 2];
    },
    tight: (s, k, t) => {
      const i = Math.floor(k / 3), j = k % 3;
      return [s.U(TL(LYR[i].bar, t)), rowY(s, i) + 12 + (j - 1) * 6];
    },
    when: (k, t) => TL(LYR[Math.floor(k / 3)].bar, t),
    wander: (s, sec) => { const i = Math.floor((Math.sin(sec * .25) + 1) * 1.49); return [s.U(TL(LYR[i].bar, .5)), rowY(s, i) + 12]; },
    // The lyrics themselves, as written in the note.
    surface: (s, ctx) => {
      ctx.font = '14px Archivo, sans-serif';
      LYR.forEach((l, i) => { ctx.fillStyle = rgba(s.C.ink, .75); ctx.fillText(l.text, s.U(TL(l.bar)), rowY(s, i)); });
    },
    backdrop: (s, o) => {
      o.strokeStyle = rgba(s.C.line, 1); o.lineWidth = 1; mono(o, 10);
      for (let b = 1; b <= 13; b++) { const x = s.U(TL(b)); o.beginPath(); o.moveTo(x, 0); o.lineTo(x, s.H); o.stroke(); }
      LYR.forEach((l, i) => { o.fillStyle = rgba(s.C.acc, 1); o.fillText(`[${l.bar}]`, s.U(TL(l.bar)) - 2, rowY(s, i) + 34); });
    },
    label: (s, x, y) => { const l = LYR[lineAt(s, y)]; return `[${l.bar}] · a clip on bar ${l.bar}`; },
    audio: at => LYR.forEach((l, i) => [60, 64, 67].forEach((m, j) => tone(m + [0, 5, -3][i], at + (l.bar - 1) / 12 * 3.2 + j * .04, .9, .05))),
  });
}
