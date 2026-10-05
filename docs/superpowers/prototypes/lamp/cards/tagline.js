// Tagline: captures, triaged, tagged, ready before you play. Captures arrive
// loose, each with a few words on why it caught you. Under the lamp they get
// triaged: keepers pull straight and take your hashtags, and the drops go
// slack and fall away.
{
  const CAPS = [
    { why: 'the bassline at 2:10', keep: ['#descent', '#dj-able'] },
    { why: 'heard it at a friend’s', keep: null },
    { why: 'that vocal chop', keep: ['#warm-up', '#vocal'] },
    { why: 'good for a slow start', keep: ['#warm-up'] },
    { why: 'too busy, maybe', keep: null },
    { why: 'the drop, obviously', keep: ['#peak', '#dj-able'] },
  ];
  const keepers = CAPS.map((c, i) => c.keep ? i : -1).filter(i => i >= 0);
  const laneY = (s, k) => s.V(.12 + keepers.indexOf(k) * .2);
  const restY = (s, k, t, sec) => s.V(.5 + .34 * Math.sin(t * (2.2 + k * .55) + k * 1.9 + sec * .2) * Math.sin(t * 1.7 + k * .8));
  const pillX = (s, j) => s.U(.08 + j * .17);
  card({
    name: 'Tagline', category: 'workflow',
    line: 'Catch a track on your phone, keep it or drop it, tag it once. It is in your crate, findable, before you play.',
    strings: CAPS.length,
    base: k => CAPS[k].keep ? .55 : .35,
    colour: k => CAPS[k].keep ? 'acc' : 'mut',
    rest: (s, k, t, sec) => [s.U(t), restY(s, k, t, sec)],
    tight: (s, k, t, sec) => {
      if (CAPS[k].keep) return [s.U(t), laneY(s, k)];
      // A drop goes slack: it sags and falls below the card.
      return [s.U(t), restY(s, k, t, sec) + s.H * (.55 + .25 * Math.sin(Math.PI * t))];
    },
    // Hashtags threaded on the keepers, on top of the strings, shown where the
    // lamp is or the playhead has passed.
    over: (s, ctx) => {
      mono(ctx, 10);
      keepers.forEach(k => {
        CAPS[k].keep.forEach((h, j) => {
          const x = pillX(s, j), y = laneY(s, k), a = s.lit(x, y, s.u(x));
          if (a < .05) return;
          const tw = ctx.measureText(h).width;
          ctx.fillStyle = rgba(s.C.ground, a); ctx.fillRect(x - 5, y - 8, tw + 10, 16);
          ctx.strokeStyle = rgba(s.C.acc, a); ctx.lineWidth = 1; ctx.strokeRect(x - 4.5, y - 7.5, tw + 9, 15);
          ctx.fillStyle = rgba(s.C.ink, a); ctx.fillText(h, x, y + 3.5);
        });
      });
    },
    // The capture the lamp is closest to, its reason, and what triage made of it.
    label: (s, x, y) => {
      const t = clamp(s.u(x), 0, 1);
      let best = 0, bd = 1e9;
      CAPS.forEach((c, k) => {
        const w = c.keep ? s.wAt(x, laneY(s, k)) : 0;
        const yy = c.keep ? laneY(s, k) * w + restY(s, k, t, s.sec) * (1 - w) : restY(s, k, t, s.sec);
        if (Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = k; }
      });
      const c = CAPS[best];
      return `“${c.why}” · ${c.keep ? 'kept ' + c.keep.join(' ') : 'dropped'}`;
    },
    playLabel: (s, p) => ({ text: 'keep or drop · tag once · ready to play', x: s.U(p) + 8, y: s.V(.02) + 8 }),
    audio: at => {
      CAPS.forEach((c, k) => {
        const when = at + (k + .5) / CAPS.length * 3.2;
        if (c.keep) { tone(72, when, .18, .08, 'sine'); c.keep.forEach((_, j) => tone(79 + j * 5, when + .08 + j * .08, .15, .05, 'sine')); }
        else tone(52, when, .3, .07, 'triangle', 45);
      });
    },
  });
}
