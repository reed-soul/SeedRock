/* ──────────────────────────────────────────────────────────────
   SeedRock panel-fx — mineral-vein WebGL2 background.
   A domain-warped fbm field that reads like stratified rock grain
   / ore veins drifting slowly under the panel and loading card.
   Raw WebGL2 (no three.js) so it runs independently of the main
   render loop and costs a single fullscreen pass per frame.
   ────────────────────────────────────────────────────────────── */

// Palette read once from the CSS custom properties in theme.css so the
// shader stays in lockstep with the copper→ochre identity. Fallbacks
// match the :root defaults.
function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fb) => {
    const v = css.getPropertyValue(name).trim();
    return v || fb;
  };
  const hex = (h) => {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3
      ? s.split('').map((c) => c + c).join('')
      : s, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  return {
    copper: hex(pick('--sr-copper', '#5e8c6a')),
    ochre:  hex(pick('--sr-ochre',  '#c87f3f')),
    sand:   hex(pick('--sr-sand',   '#d4a574')),
    surface:hex(pick('--sr-surface','#16181d')),
  };
}

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_copper;
uniform vec3  u_ochre;
uniform vec3  u_sand;
uniform vec3  u_surface;

// hash + value noise + fbm — the standard toolbox, kept compact.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Aspect-correct so veins don't stretch.
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 3.0;

  float t = u_time * 0.045;

  // Domain warp: the fbm output offsets the sample coordinate, so the
  // grain flows and folds instead of just scrolling — this is what
  // makes it read as rock strata / mineral veins rather than clouds.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * 0.7));
  float n = fbm(p + q * 1.8 + t * 0.3);

  // Stratify: sharpen along one axis to suggest layered bedding planes.
  float strata = sin((p.y + q.y * 2.0) * 6.0 + n * 4.0) * 0.5 + 0.5;
  float vein = smoothstep(0.55, 0.72, n) * smoothstep(0.3, 0.5, strata);

  // Base mineral tone → lit vein highlight.
  vec3 base = mix(u_surface * 0.6, u_copper * 0.7, n);
  vec3 col = mix(base, u_ochre, vein * 0.8);
  col = mix(col, u_sand, smoothstep(0.78, 0.9, n) * 0.6);

  // Edge glow so the vein texture is strongest at the panel border,
  // fading toward the centre where text/controls sit.
  float edge = smoothstep(0.0, 0.28, uv.x) * smoothstep(1.0, 0.72, uv.x)
             * smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.78, uv.y);
  col *= 0.42 + 0.58 * (1.0 - edge);

  // Subtle vignette + gain.
  float vig = 1.0 - 0.25 * length(uv - 0.5);
  outColor = vec4(col * vig, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[panel-fx] shader compile failed:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * Mount a mineral-vein background canvas inside `host`.
 *
 * @param {HTMLElement} host  the element to attach the canvas behind
 * @returns {{ pause: () => void, resume: () => void } | null}
 *   null if WebGL2 is unavailable (caller falls back to plain surface).
 */
export function mountPanelFX(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sr-fx';
  // Insert as the FIRST child so it sits below the scrim/content layers.
  host.insertBefore(canvas, host.firstChild);

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) {
    // No WebGL2 — leave the canvas inert; the CSS scrim still gives a
    // clean surface, just without the animated veins.
    console.info('[panel-fx] WebGL2 unavailable — static background fallback.');
    return null;
  }

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[panel-fx] program link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  // Fullscreen triangle (covers clip space with one tri, no overlap).
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {
    time:    gl.getUniformLocation(prog, 'u_time'),
    res:     gl.getUniformLocation(prog, 'u_res'),
    copper:  gl.getUniformLocation(prog, 'u_copper'),
    ochre:   gl.getUniformLocation(prog, 'u_ochre'),
    sand:    gl.getUniformLocation(prog, 'u_sand'),
    surface: gl.getUniformLocation(prog, 'u_surface'),
  };

  let palette = readPalette();
  let running = true;
  let raf = 0;

  const resize = () => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Re-read palette shortly after mount (CSS custom props are
  // available synchronously, but re-read once covers late hydration).
  setTimeout(() => { palette = readPalette(); }, 200);

  const render = (t) => {
    if (!running) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(U.time, t * 0.001);
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform3fv(U.copper, palette.copper);
    gl.uniform3fv(U.ochre, palette.ochre);
    gl.uniform3fv(U.sand, palette.sand);
    gl.uniform3fv(U.surface, palette.surface);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);

  // Pause when the host scrolls out of view or the tab hides, to keep
  // the FX off the GPU when nobody is looking.
  const onVis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running) { running = true; raf = requestAnimationFrame(render); }
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    pause()  { running = false; cancelAnimationFrame(raf); },
    resume() { if (!running) { running = true; raf = requestAnimationFrame(render); } },
  };
}
