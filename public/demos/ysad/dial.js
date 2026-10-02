// A Live-style dial, after the live.dial objects in m4l/max/ysad.maxpat
// (kick, snare, hat, perc, intensity: 0..1, default 0.5, float readout).
// It behaves like a knob in Live's device view:
//   - drag up or down to turn (the pointer's horizontal motion is ignored),
//     about 200 px for the whole range; shift while dragging turns 10x finer
//   - double-click (or double-tap) resets to the default, as does Delete
//   - arrows step it when focused (shift for fine), Home / End go to the ends
//   - an arc from the minimum to the value, a needle, and the value below
// The value math is pure (dialModel) and tested in node; createDial wraps
// it in an SVG and pointer events.

export const DRAG_PX = 200;     // pixels of vertical drag for the full range
export const FINE = 10;         // shift-drag is this many times finer
export const SWEEP = 270;       // degrees of arc, open at the bottom
const DOUBLE_MS = 350;          // two presses within this are a double press
const STILL_PX = 4;             // a press that moved less than this is a tap

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Round v to the nearest step above min, and trim float noise. */
export function snap(v, step, min = 0) {
  if (!step) return v;
  const n = Math.round((v - min) / step);
  return +(min + n * step).toFixed(10);
}

/** Value after a vertical drag of dyUp pixels (positive = pointer moved up). */
export function dragValue(v, dyUp, { min = 0, max = 1, fine = false, px = DRAG_PX } = {}) {
  const perPx = (max - min) / px / (fine ? FINE : 1);
  return clamp(v + dyUp * perPx, min, max);
}

/** Needle angle in degrees for a value, 0 = straight up, clockwise positive. */
export function angleFor(v, min = 0, max = 1) {
  const f = (clamp(v, min, max) - min) / (max - min || 1);
  return -SWEEP / 2 + f * SWEEP;
}

/**
 * The dial's state without any DOM. `raw` keeps sub-step drag motion so a
 * slow fine drag still adds up; `value` is raw snapped to `step`.
 */
export function dialModel({ min = 0, max = 1, value, def, step = 0.01, keyStep = 0.05 } = {}) {
  const home = def ?? (min + max) / 2;
  let raw = clamp(value ?? home, min, max);
  const m = {
    min, max, step, keyStep, def: home,
    get value() { return clamp(snap(raw, step, min), min, max); },
    set(v) { raw = clamp(v, min, max); return m.value; },
    drag(dyUp, fine = false) { raw = dragValue(raw, dyUp, { min, max, fine }); return m.value; },
    reset() { raw = home; return m.value; },
    // Returns the new value, or null when the key is not the dial's.
    key(k, shift = false) {
      const d = shift ? step : keyStep;
      switch (k) {
        case 'ArrowUp': case 'ArrowRight': return m.set(snap(m.value + d, step, min));
        case 'ArrowDown': case 'ArrowLeft': return m.set(snap(m.value - d, step, min));
        case 'PageUp': return m.set(snap(m.value + keyStep * 4, step, min));
        case 'PageDown': return m.set(snap(m.value - keyStep * 4, step, min));
        case 'Home': return m.set(min);
        case 'End': return m.set(max);
        case 'Delete': case 'Backspace': return m.reset();
        default: return null;
      }
    },
  };
  return m;
}

const SVG = 'http://www.w3.org/2000/svg';
const R = 17;   // arc radius in a 44 x 44 box, as in the device
const C = 22;

function polar(deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [C + R * Math.cos(a), C + R * Math.sin(a)];
}
function arc(fromDeg, toDeg) {
  const [x0, y0] = polar(fromDeg);
  const [x1, y1] = polar(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * Builds a dial inside host. Options: id, label, min, max, value, def, step,
 * keyStep, format(v) for the readout, spoken(v) for assistive tech (default:
 * the readout), onInput(v) on every change.
 * A list (a menu in the device) is a dial over its indexes: min 0, max
 * length - 1, step and keyStep 1, format (i) => list[i].
 */
export function createDial(host, { id, label, format = (v) => v.toFixed(2), spoken = format, onInput = () => {}, ...opts } = {}) {
  const model = dialModel(opts);
  const root = document.createElement('div');
  root.className = 'dial';

  const name = document.createElement('span');
  name.className = 'dial-label';
  name.textContent = label;

  const knob = document.createElement('div');
  knob.className = 'dial-knob';
  if (id) knob.id = id;
  knob.tabIndex = 0;
  knob.setAttribute('role', 'slider');
  knob.setAttribute('aria-label', label);
  knob.setAttribute('aria-valuemin', String(model.min));
  knob.setAttribute('aria-valuemax', String(model.max));
  knob.setAttribute('aria-orientation', 'vertical');

  const svg = svgEl('svg', { viewBox: '0 0 44 44', 'aria-hidden': 'true', focusable: 'false' });
  const track = svgEl('path', { class: 'dial-track', d: arc(-SWEEP / 2, SWEEP / 2) });
  const fill = svgEl('path', { class: 'dial-fill' });
  const needle = svgEl('line', { class: 'dial-needle', x1: C, y1: C, x2: C, y2: C - R });
  svg.append(track, fill, needle);
  knob.append(svg);

  const out = document.createElement('output');
  out.className = 'dial-value';
  if (id) out.id = `${id}-out`;

  root.append(name, knob, out);
  host.append(root);

  function paint() {
    const v = model.value;
    const deg = angleFor(v, model.min, model.max);
    // A zero-length arc draws a dot on some engines; leave it empty instead.
    fill.setAttribute('d', deg > -SWEEP / 2 + 0.5 ? arc(-SWEEP / 2, deg) : '');
    needle.setAttribute('transform', `rotate(${deg.toFixed(2)} ${C} ${C})`);
    out.value = format(v);
    knob.setAttribute('aria-valuenow', String(v));
    knob.setAttribute('aria-valuetext', spoken(v));
  }
  function emit(before) {
    paint();
    if (model.value !== before) onInput(model.value);
  }

  // Pointer: vertical drag from wherever the press started; no jump on press.
  let drag = null;       // { id, y, moved }
  let lastUp = { t: -Infinity, still: false };
  knob.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    knob.focus({ preventScroll: true });
    if (lastUp.still && e.timeStamp - lastUp.t < DOUBLE_MS) {
      // Double press: back to the default, and this press does not drag.
      lastUp = { t: -Infinity, still: false };
      const before = model.value;
      model.reset();
      emit(before);
      return;
    }
    drag = { id: e.pointerId, y: e.clientY, moved: 0 };
    knob.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
  });
  knob.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = drag.y - e.clientY;
    drag.y = e.clientY;
    drag.moved += Math.abs(dy);
    const before = model.value;
    model.drag(dy, e.shiftKey);
    emit(before);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    lastUp = { t: e.timeStamp, still: drag.moved < STILL_PX };
    drag = null;
    root.classList.remove('is-dragging');
  };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  knob.addEventListener('lostpointercapture', end);

  knob.addEventListener('keydown', (e) => {
    const before = model.value;
    if (model.key(e.key, e.shiftKey) === null) return;
    e.preventDefault();
    emit(before);
  });

  paint();
  return {
    el: root,
    knob,
    get value() { return model.value; },
    // Sets the value without calling onInput (for resets from outside).
    set(v) { model.set(v); paint(); },
    reset() { model.reset(); paint(); },
  };
}
