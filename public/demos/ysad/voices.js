// The demo's drum voices: General MIDI channel 10 (the Standard kit) of the
// design system's shared soundfont (vendor/design/sound/gm.sf3, the same sounds
// as every other tool that plays MIDI), played by the design system's spessasynth
// (vendor/design/sound/spessasynth). The
// four voices sit on the Max device's own notes (m4l/src/kit.js): kick 36,
// snare 38, closed hat 42, perc 39 (clap). Each voice takes (time in
// AudioContext seconds, velocity 1..127, gate in seconds): the hit is scheduled
// at that exact time (on the synth's clock, see `offset`), with its note-off one
// gate later, as the device sends it.
//
// makeVoices(ctx) returns at once; the synth is ready a moment later
// (`ready` turns true), and the player waits for it before its first bar, so
// the first press always sounds. preloadSounds() fetches the bank and the
// library ahead of the first press.

const VENDOR = new URL('./vendor/design/sound/spessasynth/', import.meta.url);
const SF_VERSION = '1';
const SF_URL = new URL(`./vendor/design/sound/gm.sf3?v=${SF_VERSION}`, import.meta.url).href;
const SF_CACHE = 'ysad-soundfont';
const DRUMS = 9; // MIDI channel 10

export const NOTES = Object.freeze({ kick: 36, snare: 38, hat: 42, perc: 39 });

let bank = null;
// The bank's bytes: from the browser's cache, else fetched once and cached.
function soundfontBytes() {
  bank = bank || (async () => {
    let cache = null;
    try { cache = await caches.open(SF_CACHE); } catch { /* no Cache API here: fetch every time */ }
    let res = cache && (await cache.match(SF_URL));
    if (!res) {
      res = await fetch(SF_URL);
      if (!res.ok) throw new Error(`the drum sounds did not load (${res.status})`);
      if (cache) {
        for (const old of await cache.keys()) if (old.url !== SF_URL) await cache.delete(old);
        await cache.put(SF_URL, res.clone()).catch(() => {});
      }
    }
    return res.arrayBuffer();
  })();
  bank.catch(() => { bank = null; });
  return bank;
}

let lib = null;
const loadLib = () => (lib = lib || import(new URL('spessasynth_lib.min.js', VENDOR).href));

export function preloadSounds() {
  soundfontBytes().catch(() => {});
  loadLib().catch(() => { lib = null; });
}

export function makeVoices(ctx) {
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  const meter = ctx.createAnalyser(); // read by peak(): is anything sounding
  out.connect(meter);

  let synth = null;
  let error = null;
  // spessasynth schedules on its own clock, which starts a little behind the
  // AudioContext's (by however long the worklet took to start, about 40 ms
  // here) and then runs at the same rate. Every message from the worklet
  // carries its clock, read against the context's as it arrives; a message can
  // only arrive late, so the largest difference seen is the offset.
  let offset = null;
  const loading = (async () => {
    const [{ WorkletSynthesizer }, sf] = await Promise.all([loadLib(), soundfontBytes()]);
    await ctx.audioWorklet.addModule(new URL('spessasynth_processor.min.js', VENDOR).href);
    const s = new WorkletSynthesizer(ctx);
    s.worklet.port.addEventListener('message', (e) => {
      const t = e.data && e.data.currentTime;
      if (typeof t !== 'number') return;
      const d = t - ctx.currentTime;
      if (offset === null || d > offset) offset = d;
    });
    s.connect(out);
    await s.soundBankManager.addSoundBank(sf, 'main');
    await s.isReady;
    synth = s;
  })();
  loading.catch((e) => { error = e; console.error(e); });

  const clampVel = (vel) => Math.max(1, Math.min(127, Math.round(vel)));

  function hit(note) {
    return (time, vel, gate) => {
      if (!synth) return; // still loading: the player waits for `ready` first
      const at = time + (offset || 0); // the context's time on the synth's clock
      synth.noteOn(DRUMS, note, clampVel(vel), { time: at });
      synth.noteOff(DRUMS, note, { time: at + Math.max(0.01, gate || 0.05) });
    };
  }

  return {
    kick: hit(NOTES.kick),
    snare: hit(NOTES.snare),
    hat: hit(NOTES.hat),
    perc: hit(NOTES.perc),
    get ready() { return synth !== null; },
    get error() { return error; },
    get clockOffset() { return offset; },
    loading,
    // The output's peak right now (0 to 1): 0 means silence.
    peak() {
      const buf = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(buf);
      let m = 0;
      for (const x of buf) m = Math.max(m, Math.abs(x));
      return m;
    },
  };
}
