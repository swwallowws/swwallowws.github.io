#!/usr/bin/env python3
"""Cut a carousel hook from a recording: crop the product's own panels out of
the frame and lay them out on a plain canvas shaped like an open band.

  python3 scripts/hook.py visuals/edits/<project>-hook.json

The spec (paths relative to the showcase folder):
  {
    "source": "visuals/raw/<project>/<take>.mp4",
    "segments": [[start, end], ...],          # seconds, joined in order
    "canvas": [w, h], "bg": "auto" | "#rrggbb",
    "panels": [{"crop": [x, y, w, h], "at": [x, y], "scale": 1.0}, ...],
    "out": "visuals/raw/<project>/hook.mp4"
  }
A segment can also be {"t": [start, end], "panels": [...], "source": ...} to
lay that stretch out its own way (and take it from another recording); plain
[start, end] segments use the top-level panels and source. A panel can carry
its own "source" and "t" (its start there), to play beside the segment's own
recording for the segment's length.
"audio": false leaves the sound out; "gain" (dB) lifts it (a segment can carry
its own "gain" too, to match recordings made at different levels), "audioFade"
(seconds) eases it in and out at the ends, so the loop comes round softly;
"audioJoin" (seconds) eases the sound at each join, even where the picture
cuts straight (default: "fade").
"bg": "auto" samples the recording's background at (4, 4) of the first frame,
or at "bgAt": [x, y] when the corner is outside the product.
"fade": seconds (optional, default 0) dips each segment in and out through the
background, so a change of layout doesn't land as a hard cut.
Then `npm run visuals` encodes the result.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sample_bg(src, t, at=(4, 4)):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-ss', str(t), '-i', src, '-frames:v', '1',
         '-vf', f'crop=2:2:{at[0]}:{at[1]}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
        check=True, capture_output=True).stdout
    return '#%02x%02x%02x' % tuple(raw[:3])


def main():
    spec = json.load(open(sys.argv[1]))
    src = os.path.join(ROOT, spec['source'])
    out = os.path.join(ROOT, spec['out'])
    segs, layouts, sources = [], [], []
    for s in spec['segments']:
        if isinstance(s, dict):
            segs.append(s['t'])
            layouts.append(s.get('panels', spec.get('panels')))
            sources.append(os.path.join(ROOT, s.get('source', spec['source'])))
        else:
            segs.append(s)
            layouts.append(spec['panels'])
            sources.append(src)
    # every panel's recording and where it starts there
    uses = [[(os.path.join(ROOT, p['source']) if 'source' in p else sources[k], p.get('t', segs[k][0]))
             for p in layouts[k]] for k in range(len(segs))]
    inputs = list(dict.fromkeys(sources + [f for u in uses for f, _ in u]))
    cw, ch = spec['canvas']
    bg = spec.get('bg', 'auto')
    if bg == 'auto':
        bg = sample_bg(src, segs[0][0], spec.get('bgAt', (4, 4)))
    fade = spec.get('fade', 0)
    # sound only when every recording has it
    has_audio = all(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f],
        capture_output=True, text=True).stdout.strip() for f in inputs) and spec.get('audio', True)

    parts = []
    # picture and sound are trimmed and joined separately, so the sound never drifts
    n = len(segs)
    idx = [inputs.index(f) for f in sources]
    # each segment is laid out on its own canvas, then the canvases are joined
    for j, f in enumerate(inputs):
        mine = [(k, i) for k in range(n) for i, (g, _) in enumerate(uses[k]) if g == f]
        if mine:
            parts.append(f'[{j}:v]split={len(mine)}' + ''.join(f'[s{k}_{i}]' for k, i in mine))
    for k, ((a, b), panels) in enumerate(zip(segs, layouts)):
        parts.append(f'color=c={bg}:s={cw}x{ch}:d={b - a}:r=30[c{k}_0]')
        for i, p in enumerate(panels):
            x, y, w, h = p['crop']
            s = p.get('scale', 1.0)
            sw, sh = round(w * s / 2) * 2, round(h * s / 2) * 2
            t0 = uses[k][i][1]
            parts.append(f'[s{k}_{i}]trim={t0}:{t0 + b - a},setpts=PTS-STARTPTS,fps=30,'
                         f'crop={w}:{h}:{x}:{y},scale={sw}:{sh}:flags=lanczos[p{k}_{i}]')
            ax, ay = p['at']
            parts.append(f'[c{k}_{i}][p{k}_{i}]overlay={ax}:{ay}:shortest=1[c{k}_{i + 1}]')
        dip = ''
        if fade > 0:
            col = bg.replace('#', '0x')
            dip = (f',fade=t=in:st=0:d={fade}:color={col}'
                   f',fade=t=out:st={b - a - fade}:d={fade}:color={col}')
        parts.append(f'[c{k}_{len(panels)}]setsar=1{dip}[v{k}]')
        if has_audio:
            # the sound dips with the picture, so a join is never a hard cut
            jf = spec.get('audioJoin', fade)
            adip = f',afade=t=in:d={jf},afade=t=out:st={b - a - jf}:d={jf}' if jf > 0 and n > 1 else ''
            sg = spec['segments'][k]
            sgain = f',volume={sg["gain"]}dB' if isinstance(sg, dict) and 'gain' in sg else ''
            parts.append(f'[{idx[k]}:a]atrim={a}:{b},asetpts=PTS-STARTPTS{sgain}{adip}[a{k}]')
    parts.append(''.join(f'[v{k}]' for k in range(n)) + f'concat=n={n}:v=1:a=0[vj]')
    total = sum(b - a for a, b in segs)
    if has_audio:
        post = f',volume={spec["gain"]}dB' if 'gain' in spec else ''
        af = spec.get('audioFade', 0)
        if af:
            post += f',afade=t=in:d={af},afade=t=out:st={total - af}:d={af}'
        parts.append(''.join(f'[a{k}]' for k in range(n)) + f'concat=n={n}:v=0:a=1{post}[aj]')
    graph = ';'.join(parts)
    cmd = ['ffmpeg', '-v', 'error', '-y']
    for f in inputs:
        cmd += ['-i', f]
    cmd += ['-filter_complex', graph, '-map', '[vj]']
    if has_audio:
        cmd += ['-map', '[aj]', '-c:a', 'aac', '-b:a', '160k']
    cmd += ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    print(f'{out}  {cw}x{ch}  {total:.1f}s  bg {bg}')


if __name__ == '__main__':
    main()
