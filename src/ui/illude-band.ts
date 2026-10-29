/* Odoroki's band on the stage (home.ts stage). Odoroki has no recording yet,
   and it continues illude, so its band runs illude's Electric Field shader live:
   charges orbiting, the field between them glowing, in the tool's colour. No
   audio here; the charges just drift. Without WebGL the band keeps its quiet
   tone (app.css .no-poster). */

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// after illude/src/shaders/electric.glsl: five charges, alternating signs,
// orbiting the centre; the field's strength is the light, tinted with the tool's colour
const FRAG = `precision mediump float;
uniform vec2 res;
uniform float t;
uniform vec3 ink;
const float TAU = 6.28318530718;
vec2 chargePos(float i, float tt) {
  float angle = i * TAU / 5.0 + tt * (0.5 + i * 0.1);
  float radius = 0.75 * (0.3 + 0.2 * sin(tt * 0.7 + i * 1.5));
  return vec2(cos(angle), sin(angle)) * radius;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float tt = t * 0.35;
  vec2 E = vec2(0.0);
  float spark = 0.0;
  for (int k = 0; k < 5; k++) {
    float i = float(k);
    vec2 r = uv - chargePos(i, tt);
    float d = length(r);
    float s = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
    E += normalize(r + vec2(0.001)) * (0.22 * s / pow(d + 0.001, 1.6));
    spark += exp(-d * 22.0);
  }
  float glow = 1.0 - exp(-length(E) * 0.5);
  float vignette = 1.0 - smoothstep(0.6, 1.3, length(uv));
  vec3 col = ink * glow * glow * 0.55 * (0.3 + 0.7 * vignette) + mix(ink, vec3(1.0), 0.5) * spark * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface IlludeBand {
  canvas: HTMLCanvasElement;
  /** Size the drawing to the open band (CSS px), so it never stretches. */
  size(w: number, h: number): void;
  draw(t: number): void;
}

export function illudeBand(ink: () => string): IlludeBand | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'band-poster band-live';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'res'), uT = gl.getUniformLocation(prog, 't'), uInk = gl.getUniformLocation(prog, 'ink');
  // the tool's colour as computed ("rgb(...)" or "color(srgb ...)") to 0..1
  const rgb = (css: string) => {
    const n = css.match(/[\d.]+/g)?.map(Number) ?? [1, 1, 1];
    return css.startsWith('color(') ? [n[0]!, n[1]!, n[2]!] : [n[0]! / 255, n[1]! / 255, n[2]! / 255];
  };
  return {
    canvas,
    size(w, h) {
      const dpr = Math.min(1.5, devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(t) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, t / 1000);
      const [r, g, b] = rgb(ink());
      gl.uniform3f(uInk, r!, g!, b!);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
