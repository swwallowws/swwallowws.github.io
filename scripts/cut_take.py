"""Cuts screen recordings into a showcase video from a cut list.

    python3 -I scripts/cut_take.py visuals/edits/<name>.json

The cut list (JSON) names the source recordings, the output file and size, a
few framings (rectangles of the source, in source pixels), and the segments to
keep in order. A virtual camera frames each segment; when a segment's framing
differs from the one before (or from its own `from`), the camera eases
between them over `move` seconds. Segments join with a crossfade
(`crossfade`, or a segment's own `xfade`; 0 is a hard cut). A segment with
`freeze` and `hold` instead of `in` and `out` holds one source frame, silent,
with any camera move. A segment's `caption` is drawn centred along the
bottom; a run of segments with the same caption keeps it steady, fading in
and out where the caption changes. A framing can have a mask (`masks`, keyed
by framing name: a rounded rectangle of the source, [x0, y0, x1, y1, radius]):
everything outside it is painted the ground colour, so only that window
shows, and the camera may then frame past the source's edges. The mask fades
in over a camera move into its framing. A segment's `highlight` ({"rect":
[x0, y0, x1, y1, radius], "dim": 0.6, "at": 0.4}) dims everything outside
its rectangle to that opacity of the ground colour, fading in from `at`
seconds into the segment. The audio is cut and crossfaded to match, or left
out entirely with "audio": false (a silent video with no audio track).

    {
      "sources": { "a": "/path/take-a.mp4", "b": "/path/take-b.mp4" },
      "out": "visuals/raw/<project>/<name>.mp4",
      "size": [1600, 1000], "fps": 60, "crossfade": 0.25,
      "caption": { "font": "vendor/design/fonts/InterTight.woff2", "weight": 600, "size": 26 },
      "framings": { "wide": [x, y, w], ... },     # height follows the output's aspect
      "masks": { "pad": [x0, y0, x1, y1, radius] },  # optional
      "segments": [ { "source": "a", "in": 1.0, "out": 3.4, "framing": "wide" },
                    { "source": "a", "in": 9.0, "out": 10.8, "framing": "pad", "move": 0.9,
                      "moveAt": 0.1, "caption": "As locators" } ]
    }

Frames are decoded by ffmpeg, framed with Pillow (its resize takes a
sub-pixel box, so camera moves glide instead of stepping a pixel at a time)
and piped back to ffmpeg for encoding. No OpenCV, and works with ffmpeg 4.2
(no xfade filter needed). Paths in the cut list are relative to the showcase.
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

cut = json.load(open(sys.argv[1]))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the showcase
SOURCES = cut.get("sources") or {"main": cut["source"]}
OUT = os.path.join(ROOT, cut["out"])
OW, OH = cut["size"]
FPS = cut["fps"]
XF = cut.get("crossfade", 0.25)
FRAMINGS = cut["framings"]
MASKS = cut.get("masks", {})
SEGS = cut["segments"]
FIRST = next(iter(SOURCES))


def src(seg):
    return SOURCES[seg.get("source", FIRST)]


def probe_size(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


SIZES = {name: probe_size(path) for name, path in SOURCES.items()}
if len(set(SIZES.values())) > 1:
    sys.exit(f"sources differ in size: {SIZES}")
SW, SH = SIZES[FIRST]


# ---- captions -----------------------------------------------------------------
CAP = cut.get("caption")
CAP_FADE = (CAP or {}).get("fade", 0.4)
HL_FADE = 0.5  # seconds for a highlight's dimming to fade in
INK, GROUND, LINE = (236, 230, 238), (21, 18, 26), (47, 41, 54)  # design Night tokens


def caption_font():
    """Pillow can't read woff2: make a static TTF of the design font once."""
    woff2 = os.path.join(ROOT, CAP["font"])
    weight = CAP.get("weight", 600)
    ttf = os.path.join(ROOT, "visuals/raw/_fonts", f"{os.path.splitext(os.path.basename(woff2))[0]}-{weight}.ttf")
    if not os.path.exists(ttf):
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer

        os.makedirs(os.path.dirname(ttf), exist_ok=True)
        font = TTFont(woff2)
        if "fvar" in font:
            instancer.instantiateVariableFont(font, {"wght": weight}, inplace=True)
        font.flavor = None
        font.save(ttf)
    return ImageFont.truetype(ttf, CAP.get("size", 26))


FONT = caption_font() if CAP else None
_cap_cache = {}


def caption_tile(text):
    """The caption as an RGBA tile: ground with a hairline, ink text."""
    if text not in _cap_cache:
        l, t, r, b = FONT.getbbox(text)
        px, py = 16, 10
        w, h = r - l + 2 * px, b - t + 2 * py
        tile = Image.new("RGBA", (w, h), GROUND + (230,))
        d = ImageDraw.Draw(tile)
        d.rectangle([0, 0, w - 1, h - 1], outline=LINE + (255,), width=1)
        d.text((px - l, py - t), text, font=FONT, fill=INK + (255,))
        _cap_cache[text] = tile
    return _cap_cache[text]


def draw_caption(img, text, alpha):
    if not text or alpha <= 0:
        return img
    tile = caption_tile(text)
    if alpha < 1:
        tile = tile.copy()
        tile.putalpha(tile.getchannel("A").point(lambda v: int(v * alpha)))
    img = img.convert("RGBA")
    img.alpha_composite(tile, ((OW - tile.width) // 2, OH - 32 - tile.height))
    return img.convert("RGB")


# ---- camera -------------------------------------------------------------------
def box(name):
    """A framing as (centre x, centre y, width), height from the output aspect."""
    x, y, w = FRAMINGS[name]
    h = w * OH / OW
    return (x + w / 2, y + h / 2, w)


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (t * 6 - 15) + 10)  # smootherstep


def camera(a, b, s, clamp=True):
    """Between framings a and b at eased progress s: centre lerps, width in log space.
    Unclamped, the box may reach past the source (for masked framings)."""
    cx = a[0] + (b[0] - a[0]) * s
    cy = a[1] + (b[1] - a[1]) * s
    w = math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * s)
    h = w * OH / OW
    if not clamp:
        return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    x0 = max(0.0, min(cx - w / 2, SW - w))
    y0 = max(0.0, min(cy - h / 2, SH - h))
    return (x0, y0, min(SW, x0 + w), min(SH, y0 + h))


def frame(img, cam):
    """The camera box of the source as an output frame. Past the source's
    edges is black (crop pads), which a mask then covers."""
    x0, y0, x1, y1 = cam
    if x0 >= 0 and y0 >= 0 and x1 <= SW and y1 <= SH:
        return img.resize((OW, OH), Image.LANCZOS, box=cam)
    ix0, iy0, ix1, iy1 = math.floor(x0), math.floor(y0), math.ceil(x1), math.ceil(y1)
    part = img.crop((ix0, iy0, ix1, iy1))
    return part.resize((OW, OH), Image.LANCZOS, box=(x0 - ix0, y0 - iy0, x1 - ix0, y1 - iy0))


def apply_mask(img, mask, cam, alpha):
    """Paints outside the mask's rounded rectangle the ground colour, at alpha."""
    x0, y0, x1, y1 = cam
    sx, sy = OW / (x1 - x0), OH / (y1 - y0)
    rect = ((mask[0] - x0) * sx, (mask[1] - y0) * sy, (mask[2] - x0) * sx, (mask[3] - y0) * sy)
    keep = Image.new("L", (OW, OH), round(255 * (1 - alpha)))
    ImageDraw.Draw(keep).rounded_rectangle(rect, mask[4] * sx, fill=255)
    return Image.composite(img, Image.new("RGB", (OW, OH), GROUND), keep)


def duration(seg):
    return seg["hold"] if "freeze" in seg else seg["out"] - seg["in"]


def frames(i, start_box):
    """Yields the output frames (numpy uint8, OHxOWx3) of segment i. A segment
    with "freeze": t and "hold": seconds shows the source frame at t, still."""
    seg = SEGS[i]
    dur = duration(seg)
    target = box(seg["framing"])
    move = seg.get("move", 0)
    move_at = seg.get("moveAt", 0)
    if "from" in seg:
        start_box = box(seg["from"])
    begin = start_box if move > 0 and start_box is not None else target
    mask = MASKS.get(seg["framing"])
    moving_in = begin != target
    hl = seg.get("highlight")
    text = seg.get("caption")
    fade_in = text and (i == 0 or SEGS[i - 1].get("caption") != text)
    fade_out = text and (i + 1 == len(SEGS) or SEGS[i + 1].get("caption") != text)
    # one caption replacing another swaps right at the cut, with no pause
    swap_in = fade_in and i > 0 and SEGS[i - 1].get("caption")
    swap_out = fade_out and i + 1 < len(SEGS) and SEGS[i + 1].get("caption")
    at = seg["freeze"] if "freeze" in seg else seg["in"]
    span = ["-frames:v", "1"] if "freeze" in seg else ["-t", str(dur)]
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-ss", str(at), "-i", src(seg), *span,
         "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    size = SW * SH * 3
    still = None
    total = round(dur * FPS)
    n = 0
    while n < total:
        if still is None:
            raw = proc.stdout.read(size)
            if len(raw) < size:
                break
            if "freeze" in seg:
                still = raw
        else:
            raw = still
        t = n / FPS
        s = ease((t - move_at) / move) if move > 0 else 1.0
        img = Image.frombuffer("RGB", (SW, SH), raw, "raw", "RGB", 0, 1)
        cam = camera(begin, target, s, clamp=mask is None)
        out = frame(img, cam)
        if mask:
            out = apply_mask(out, mask, cam, s if moving_in else 1.0)
        if hl:
            dim = hl.get("dim", 0.6) * ease((t - hl.get("at", 0.4)) / HL_FADE)
            if dim > 0:
                out = apply_mask(out, hl["rect"], cam, dim)
        if text:
            alpha = 1.0
            if fade_in:
                alpha = min(alpha, ease((t - (0 if swap_in else 0.15)) / CAP_FADE))
            if fade_out:
                alpha = min(alpha, ease((dur - t - (0 if swap_out else 0.1)) / CAP_FADE))
            out = draw_caption(out, text, alpha)
        yield np.asarray(out)
        n += 1
    proc.stdout.close()
    proc.wait()


def audio(path):
    """The segments' audio, joined with the same crossfades, as a WAV."""
    names = list(SOURCES)
    parts, chain = [], ""
    for i, seg in enumerate(SEGS):
        if "freeze" in seg:  # a held frame is silent
            parts.append(f"aevalsrc=0|0:c=stereo:s=48000:d={seg['hold']}[a{i}]")
        else:
            k = names.index(seg.get("source", FIRST))
            parts.append(f"[{k}:a]atrim={seg['in']}:{seg['out']},asetpts=PTS-STARTPTS[a{i}]")
    prev = "a0"
    for i in range(1, len(SEGS)):
        d = SEGS[i].get("xfade", XF)
        if d > 0:
            chain += f";[{prev}][a{i}]acrossfade=d={d}:c1=tri:c2=tri[x{i}]"
        else:  # a hard cut
            chain += f";[{prev}][a{i}]concat=n=2:v=0:a=1[x{i}]"
        prev = f"x{i}"
    inputs = [arg for p in SOURCES.values() for arg in ("-i", p)]
    graph = ";".join(parts) + chain
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", f"[{prev}]", path], check=True)


# ---- render -------------------------------------------------------------------
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
# "audio": false renders a silent video with no audio track, so players can tell
HAS_AUDIO = cut.get("audio", True)
wav = OUT + ".audio.wav"
if HAS_AUDIO:
    audio(wav)
sound = ["-i", wav] if HAS_AUDIO else []
sound_out = ["-c:a", "aac", "-b:a", "256k", "-shortest"] if HAS_AUDIO else ["-an"]

enc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
     *sound, "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p",
     *sound_out, "-movflags", "+faststart", OUT],
    stdin=subprocess.PIPE,
)

tail = []  # the previous segment's last frames, held back to crossfade into
prev_box = None
written = 0
for i, seg in enumerate(SEGS):
    nxt = round(SEGS[i + 1].get("xfade", XF) * FPS) if i + 1 < len(SEGS) else 0
    held = []
    for k, f in enumerate(frames(i, prev_box)):
        if k < len(tail):  # crossfade over the overlap
            a = k / max(1, len(tail))
            f = (tail[k] * (1 - a) + f * a).astype(np.uint8)
        held.append(f)
        while len(held) > nxt:  # keep enough frames back for the next crossfade
            enc.stdin.write(held.pop(0).tobytes())
            written += 1
    tail = [f.astype(np.float32) for f in held]
    prev_box = box(seg["framing"])
    span = f"freeze {seg['freeze']} for {seg['hold']}" if "freeze" in seg else f"{seg['in']}-{seg['out']}"
    print(f"segment {i + 1}/{len(SEGS)} {seg.get('source', FIRST)} {span} ({seg['framing']})", flush=True)
for f in tail:
    enc.stdin.write(f.astype(np.uint8).tobytes())
    written += 1
enc.stdin.close()
enc.wait()
if HAS_AUDIO:
    os.remove(wav)
print(f"wrote {OUT}: {written} frames, {written / FPS:.1f} s")
