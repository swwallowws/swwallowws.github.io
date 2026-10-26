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
[start, end] segments use the top-level panels and source.
"bg": "auto" samples the recording's background at (4, 4) of the first frame.
"fade": seconds (optional, default 0) dips each segment in and out through the
background, so a change of layout doesn't land as a hard cut.
Then `npm run visuals` encodes the result.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sample_bg(src, t):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-ss', str(t), '-i', src, '-frames:v', '1',
         '-vf', 'crop=2:2:4:4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
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
    inputs = list(dict.fromkeys(sources))
    cw, ch = spec['canvas']
    bg = spec.get('bg', 'auto')
    if bg == 'auto':
        bg = sample_bg(src, segs[0][0])
    fade = spec.get('fade', 0)
    # sound only when every recording has it
    has_audio = all(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', f],
        capture_output=True, text=True).stdout.strip() for f in inputs)

    parts = []
    # picture and sound are trimmed and joined separately, so the sound never drifts
    n = len(segs)
    idx = [inputs.index(f) for f in sources]
    # each segment is laid out on its own canvas, then the canvases are joined
    for j in range(len(inputs)):
        uses = [k for k in range(n) if idx[k] == j]
        parts.append(f'[{j}:v]split={len(uses)}' + ''.join(f'[r{k}]' for k in uses))
    for k, ((a, b), panels) in enumerate(zip(segs, layouts)):
        parts.append(f'[r{k}]trim={a}:{b},setpts=PTS-STARTPTS,fps=30,split={len(panels)}'
                     + ''.join(f'[s{k}_{i}]' for i in range(len(panels))))
        parts.append(f'color=c={bg}:s={cw}x{ch}:d={b - a}:r=30[c{k}_0]')
        for i, p in enumerate(panels):
            x, y, w, h = p['crop']
            s = p.get('scale', 1.0)
            sw, sh = round(w * s / 2) * 2, round(h * s / 2) * 2
            parts.append(f'[s{k}_{i}]crop={w}:{h}:{x}:{y},scale={sw}:{sh}:flags=lanczos[p{k}_{i}]')
            ax, ay = p['at']
            parts.append(f'[c{k}_{i}][p{k}_{i}]overlay={ax}:{ay}:shortest=1[c{k}_{i + 1}]')
        dip = ''
        if fade > 0:
            col = bg.replace('#', '0x')
            dip = (f',fade=t=in:st=0:d={fade}:color={col}'
                   f',fade=t=out:st={b - a - fade}:d={fade}:color={col}')
        parts.append(f'[c{k}_{len(panels)}]setsar=1{dip}[v{k}]')
        if has_audio:
            parts.append(f'[{idx[k]}:a]atrim={a}:{b},asetpts=PTS-STARTPTS[a{k}]')
    parts.append(''.join(f'[v{k}]' for k in range(n)) + f'concat=n={n}:v=1:a=0[vj]')
    if has_audio:
        parts.append(''.join(f'[a{k}]' for k in range(n)) + f'concat=n={n}:v=0:a=1[aj]')
    total = sum(b - a for a, b in segs)
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
