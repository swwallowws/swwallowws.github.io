// Rearranged, before and after: the same chords, pressed differently.
// Each row has one string per chord note, at its pitch, stepping with the
// chords. A string sits at its pitch while its note is pressed and dips a
// little when released, so every press shows where it starts and ends.
// Before: one press per bar, held the whole bar.
// After: two presses per bar, shorter, the three notes starting and ending at
// slightly different times. Click a row to hear it.
//
// `rearrangedCard(motion)` makes the card; what the lamp does to the strings:
//   'still'  only colours them,
//   'morph'  the top row's presses split and slide into the after pattern,
//            right where the lamp is, and slide back as it leaves (the chosen
//            one, on the all-projects page),
//   'touch'  the strings in both rows lift and ripple a little, as if touched.
// The page calls it, unless it sets window.REARRANGED_MANUAL first.
function rearrangedCard(motion = 'still', extra = {}) {
  const CHORDS = [{ name: 'Am', notes: [57, 60, 64] }, { name: 'F', notes: [57, 60, 65] }, { name: 'C', notes: [55, 60, 64] }, { name: 'G', notes: [55, 59, 62] }];
  const BARS = CHORDS.length, LO = 53, HI = 67, VOICES = 3;
  // Presses per row, in bars: [start, length], with a small offset per note in the after row.
  const PRESSES = {
    before: () => [[0, .96]],
    after: j => [[.0 + j * .04, .3 - j * .03], [.5 + j * .06, .22 + j * .02]],
  };
  const ROW = { before: [.04, .42], after: [.56, .94] };
  const rowAt = (s, y) => y < s.V((ROW.before[1] + ROW.after[0]) / 2) ? 'before' : 'after';
  const pitchY = (s, row, n) => s.V(ROW[row][0] + (1 - (n - LO) / (HI - LO)) * (ROW[row][1] - ROW[row][0]));
  // How pressed note j is at t (0 released, 1 pressed), pressed the `pattern` way, and which bar it is in.
  const pressed = (pattern, j, t) => {
    const x = t * BARS, b = Math.min(BARS - 1, Math.floor(x)), f = x - b, edge = .02;
    let on = 0;
    for (const [a, len] of PRESSES[pattern](j)) on = Math.max(on, smooth(clamp((f - a) / edge, 0, 1)) * smooth(clamp((a + len - f) / edge, 0, 1)));
    return { on, bar: b };
  };
  // A string in `row`, pressed the `pattern` way.
  const stringY = (s, row, j, t, pattern = row) => {
    const { on, bar } = pressed(pattern, j, t);
    return pitchY(s, row, CHORDS[bar].notes[j]) + (1 - on) * 7;
  };
  // Where a string is, given what the lamp is doing to it.
  const place = (s, k, t, sec) => {
    const row = k < VOICES ? 'before' : 'after', j = k % VOICES, x = s.U(t);
    let y = stringY(s, row, j, t);
    const w = s.wAt ? s.wAt(x, y) : 0;
    if (motion === 'morph' && row === 'before') y += (stringY(s, row, j, t, 'after') - y) * w;
    if (motion === 'touch') y -= w * (3 + 2.5 * Math.sin(t * 90 - sec * 9 + k));
    return [x, y];
  };
  card({
    name: 'Rearranged', category: 'transform', line: 'Your song\'s chords, played with another song\'s arrangement habits. Before and after.',
    strings: VOICES * 2,
    points: 400,
    base: () => .55,
    // The lamp's motion is worked out in `place`, so rest and tight are the same.
    rest: place,
    tight: place,
    wander: (s, sec) => { const t = .5 + .42 * Math.sin(sec * .3), row = Math.sin(sec * .17) > 0 ? 'before' : 'after'; return [s.U(t), s.V((ROW[row][0] + ROW[row][1]) / 2)]; },
    backdrop: (s, o) => {
      o.lineWidth = 1; o.strokeStyle = rgba(s.C.line, 1);
      for (let b = 0; b <= BARS; b++) { o.beginPath(); o.moveTo(s.U(b / BARS), 0); o.lineTo(s.U(b / BARS), s.H); o.stroke(); }
    },
    label: (s, x, y) => {
      const ch = CHORDS[Math.min(BARS - 1, Math.floor(clamp(s.u(x), 0, .999) * BARS))].name;
      if (rowAt(s, y) === 'after') return `after · ${ch}, two shorter presses a bar`;
      return motion === 'morph' ? `before → after · ${ch}, one press becomes two` : `before · ${ch}, one press a bar`;
    },
    playLabel: (s, p) => ({ text: s.row === 'after' ? 'after' : 'before', x: s.U(p) + 8, y: s.V(ROW[s.row ?? 'before'][0]) + 4 }),
    // Click the top row to hear before, the bottom row to hear after.
    audio: (at, s) => {
      s.row = rowAt(s, s.y);
      const bar = 3.2 / BARS;
      CHORDS.forEach((ch, b) => ch.notes.forEach((m, j) => {
        for (const [a, len] of PRESSES[s.row](j)) tone(m, at + (b + a) * bar, len * bar, .06);
      }));
    },
    ...extra,
  });
}
if (!window.REARRANGED_MANUAL) rearrangedCard('morph');
