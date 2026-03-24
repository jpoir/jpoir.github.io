/**
 * Navier-Stokes incompressible 2D fluid simulation — WebGL 2.
 *
 * Algorithm (Stable Fluids, Stam 1999) with vorticity confinement:
 *   curl → vorticity → advect velocity → divergence
 *   → Jacobi pressure → gradient subtract → advect dye → display
 *
 * Mouse splats add velocity + cycling-hue dye (vaporwave palette).
 * Idle splats on a lissajous path keep the field alive with no input.
 */

// ── Constants ────────────────────────────────────────────────────────────────
const SIM_RES       = 128
const DYE_RES       = 512
const PRESSURE_ITER = 20
const VEL_DISS      = 0.978
const DYE_DISS      = 0.986
const SPLAT_RADIUS  = 0.0018
const CURL_STR      = 6

// ── Vertex shader (all passes share this) ────────────────────────────────────
const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// ── Advection ────────────────────────────────────────────────────────────────
const ADVECT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float uDt;
uniform float uDissipation;
out vec4 fragColor;
void main() {
  vec2 vel = texture(uVelocity, vUv).xy;
  fragColor = uDissipation * texture(uSource, vUv - vel * uDt);
}`

// ── Divergence ───────────────────────────────────────────────────────────────
const DIVERGENCE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`

// ── Curl (z-component of vorticity) ──────────────────────────────────────────
const CURL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
  float R = texture(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
  float B = texture(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
  fragColor = vec4(R - L - (T - B), 0.0, 0.0, 1.0);
}`

// ── Vorticity confinement ─────────────────────────────────────────────────────
const VORTICITY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform float uCurlStr;
uniform float uDt;
out vec4 fragColor;
void main() {
  float L = texture(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uCurl, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uCurl, vUv + vec2(0.0, uTexelSize.y)).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStr * C;
  force.y *= -1.0;
  fragColor = vec4(texture(uVelocity, vUv).xy + force * uDt, 0.0, 1.0);
}`

// ── Pressure (Jacobi iteration) ───────────────────────────────────────────────
const PRESSURE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`

// ── Gradient subtract (project velocity to divergence-free) ───────────────────
const GRADIENT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  float L = texture(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  vec2 vel = texture(uVelocity, vUv).xy - 0.5 * vec2(R - L, T - B);
  fragColor = vec4(vel, 0.0, 1.0);
}`

// ── Gaussian splat ────────────────────────────────────────────────────────────
const SPLAT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
uniform float uAspect;
out vec4 fragColor;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  float splat = exp(-dot(d, d) / uRadius);
  fragColor = vec4(texture(uTarget, vUv).xyz + splat * uColor, 1.0);
}`

// ── Display ───────────────────────────────────────────────────────────────────
// ── Reflecting boundary conditions ───────────────────────────────────────────
const BOUNDARY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
out vec4 fragColor;
void main() {
  vec2 vel = texture(uVelocity, vUv).xy;
  // Negate the normal component when at a wall so velocity bounces back
  if (vUv.x < uTexelSize.x)           vel.x =  abs(vel.x);
  if (vUv.x > 1.0 - uTexelSize.x)     vel.x = -abs(vel.x);
  if (vUv.y < uTexelSize.y)           vel.y =  abs(vel.y);
  if (vUv.y > 1.0 - uTexelSize.y)     vel.y = -abs(vel.y);
  fragColor = vec4(vel, 0.0, 1.0);
}`

const DISPLAY_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDye;
out vec4 fragColor;
void main() {
  vec3 c = texture(uDye, vUv).rgb;

  // Sharpen into discrete ball-like particles:
  // raise magnitude to a power so soft halos collapse to black
  // while bright centres remain vivid
  float mag = length(c);
  float shaped = clamp(pow(mag * 2.8, 1.8), 0.0, 1.0);
  c = (mag > 0.001) ? (c / mag) * shaped : vec3(0.0);

  // Filmic tone map
  c = c / (c + vec3(0.85)) * 1.85;
  c *= 0.28;

  fragColor = vec4(c, 1.0);
}`

// ── Types ─────────────────────────────────────────────────────────────────────
type FBO  = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number; tx: number; ty: number }
type DFBO = { read: FBO; write: FBO; swap(): void }

// ── Public entry point ────────────────────────────────────────────────────────
export function initFluid(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null
  if (!gl) return () => {}
  if (!gl.getExtension('EXT_color_buffer_float')) return () => {}

  // ── Geometry — single VAO + quad shared by all passes ────────────────────
  const vao = gl.createVertexArray()!
  gl.bindVertexArray(vao)
  const quadBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.bindVertexArray(null)

  // ── Program builder ───────────────────────────────────────────────────────
  function mkShader(type: number, src: string): WebGLShader {
    const s = gl!.createShader(type)!
    gl!.shaderSource(s, src)
    gl!.compileShader(s)
    return s
  }
  function mkProg(fsSrc: string): WebGLProgram {
    const p = gl!.createProgram()!
    gl!.attachShader(p, mkShader(gl!.VERTEX_SHADER, VS))
    gl!.attachShader(p, mkShader(gl!.FRAGMENT_SHADER, fsSrc))
    gl!.linkProgram(p)
    return p
  }

  const pAdvect    = mkProg(ADVECT_FS)
  const pDiverge   = mkProg(DIVERGENCE_FS)
  const pCurl      = mkProg(CURL_FS)
  const pVorticity = mkProg(VORTICITY_FS)
  const pPressure  = mkProg(PRESSURE_FS)
  const pGradient  = mkProg(GRADIENT_FS)
  const pBoundary  = mkProg(BOUNDARY_FS)
  const pSplat     = mkProg(SPLAT_FS)
  const pDisplay   = mkProg(DISPLAY_FS)

  // ── FBO builder ───────────────────────────────────────────────────────────
  function mkFBO(w: number, h: number, iFmt: number, fmt: number, type: number, filter: number): FBO {
    const tex = gl!.createTexture()!
    gl!.bindTexture(gl!.TEXTURE_2D, tex)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE)
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE)
    gl!.texImage2D(gl!.TEXTURE_2D, 0, iFmt, w, h, 0, fmt, type, null)
    const fbo = gl!.createFramebuffer()!
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo)
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, tex, 0)
    gl!.viewport(0, 0, w, h)
    gl!.clearColor(0, 0, 0, 1)
    gl!.clear(gl!.COLOR_BUFFER_BIT)
    return { tex, fbo, w, h, tx: 1 / w, ty: 1 / h }
  }
  function mkDFBO(w: number, h: number, iFmt: number, fmt: number, type: number, filter: number): DFBO {
    let a = mkFBO(w, h, iFmt, fmt, type, filter)
    let b = mkFBO(w, h, iFmt, fmt, type, filter)
    return {
      get read()  { return a },
      get write() { return b },
      swap() { [a, b] = [b, a] },
    }
  }

  const HF = gl.HALF_FLOAT
  const velocity   = mkDFBO(SIM_RES, SIM_RES, gl.RG16F,   gl.RG,   HF, gl.LINEAR)
  const pressure   = mkDFBO(SIM_RES, SIM_RES, gl.R16F,    gl.RED,  HF, gl.NEAREST)
  const divergence = mkFBO (SIM_RES, SIM_RES, gl.R16F,    gl.RED,  HF, gl.NEAREST)
  const curlFBO    = mkFBO (SIM_RES, SIM_RES, gl.R16F,    gl.RED,  HF, gl.NEAREST)
  const dye        = mkDFBO(DYE_RES, DYE_RES, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR)

  // ── Draw helpers (track current program for uniform calls) ────────────────
  let prog: WebGLProgram = pAdvect

  function use(p: WebGLProgram) {
    prog = p
    gl!.useProgram(p)
    gl!.bindVertexArray(vao)
  }
  function draw(target: FBO | null) {
    if (target) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo)
      gl!.viewport(0, 0, target.w, target.h)
    } else {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null)
      gl!.viewport(0, 0, canvas.width, canvas.height)
    }
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }
  function bindTex(unit: number, t: WebGLTexture) {
    gl!.activeTexture(gl!.TEXTURE0 + unit)
    gl!.bindTexture(gl!.TEXTURE_2D, t)
  }
  function u1f(name: string, v: number)                     { gl!.uniform1f(gl!.getUniformLocation(prog, name), v) }
  function u2f(name: string, x: number, y: number)          { gl!.uniform2f(gl!.getUniformLocation(prog, name), x, y) }
  function u3f(name: string, x: number, y: number, z: number) { gl!.uniform3f(gl!.getUniformLocation(prog, name), x, y, z) }
  function u1i(name: string, v: number)                     { gl!.uniform1i(gl!.getUniformLocation(prog, name), v) }

  // ── Sim step helpers ──────────────────────────────────────────────────────
  const ts = { x: 1 / SIM_RES, y: 1 / SIM_RES }

  function stepCurl() {
    use(pCurl)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    u2f('uTexelSize', ts.x, ts.y)
    draw(curlFBO)
  }

  function stepVorticity(dt: number) {
    use(pVorticity)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    bindTex(1, curlFBO.tex);       u1i('uCurl', 1)
    u2f('uTexelSize', ts.x, ts.y)
    u1f('uCurlStr', CURL_STR)
    u1f('uDt', dt)
    draw(velocity.write)
    velocity.swap()
  }

  function stepAdvectVelocity(dt: number) {
    use(pAdvect)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    bindTex(1, velocity.read.tex); u1i('uSource', 1)
    u1f('uDt', dt)
    u1f('uDissipation', VEL_DISS)
    draw(velocity.write)
    velocity.swap()
  }

  function stepDivergence() {
    use(pDiverge)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    u2f('uTexelSize', ts.x, ts.y)
    draw(divergence)
  }

  function stepPressure() {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, pressure.read.fbo)
    gl!.clearColor(0, 0, 0, 1)
    gl!.clear(gl!.COLOR_BUFFER_BIT)
    use(pPressure)
    bindTex(1, divergence.tex); u1i('uDivergence', 1)
    u2f('uTexelSize', ts.x, ts.y)
    for (let i = 0; i < PRESSURE_ITER; i++) {
      bindTex(0, pressure.read.tex); u1i('uPressure', 0)
      draw(pressure.write)
      pressure.swap()
    }
  }

  function stepGradient() {
    use(pGradient)
    bindTex(0, pressure.read.tex); u1i('uPressure', 0)
    bindTex(1, velocity.read.tex); u1i('uVelocity', 1)
    u2f('uTexelSize', ts.x, ts.y)
    draw(velocity.write)
    velocity.swap()
  }

  function stepBoundary() {
    use(pBoundary)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    u2f('uTexelSize', ts.x, ts.y)
    draw(velocity.write)
    velocity.swap()
  }

  function stepAdvectDye(dt: number) {
    use(pAdvect)
    bindTex(0, velocity.read.tex); u1i('uVelocity', 0)
    bindTex(1, dye.read.tex);      u1i('uSource', 1)
    u1f('uDt', dt)
    u1f('uDissipation', DYE_DISS)
    draw(dye.write)
    dye.swap()
  }

  function doSplat(x: number, y: number, dx: number, dy: number, r: number, g: number, b: number) {
    const aspect = canvas.width / canvas.height
    use(pSplat)
    u1f('uRadius', SPLAT_RADIUS)
    u1f('uAspect', aspect)
    u2f('uPoint', x, y)

    bindTex(0, velocity.read.tex); u1i('uTarget', 0)
    u3f('uColor', dx, dy, 0)
    draw(velocity.write)
    velocity.swap()

    bindTex(0, dye.read.tex); u1i('uTarget', 0)
    u3f('uColor', r, g, b)
    draw(dye.write)
    dye.swap()
  }

  function stepDisplay() {
    use(pDisplay)
    bindTex(0, dye.read.tex); u1i('uDye', 0)
    draw(null)
  }

  // ── Color cycling — oscillates through vaporwave hues ────────────────────
  function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    const f = (n: number) => {
      const k = (n + h * 6) % 6
      return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    }
    return [f(5), f(3), f(1)]
  }

  function cycleColor(t: number): [number, number, number] {
    // Sweeps hue: blue/cyan (0.53) ↔ purple (0.77) ↔ pink (0.90)
    const hue = 0.53 + 0.37 * (Math.sin(t * 0.35) * 0.5 + 0.5)
    return hsvToRgb(hue, 0.88, 1.5) // over-bright so tone-map keeps it vivid
  }

  // ── Mouse / touch handling ────────────────────────────────────────────────
  const mouse = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false }

  function onMouseMove(e: MouseEvent) {
    mouse.px = mouse.x; mouse.py = mouse.y
    mouse.x  = e.clientX / window.innerWidth
    mouse.y  = 1.0 - e.clientY / window.innerHeight
    mouse.moved = true
  }
  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]!
    mouse.px = mouse.x; mouse.py = mouse.y
    mouse.x  = t.clientX / window.innerWidth
    mouse.y  = 1.0 - t.clientY / window.innerHeight
    mouse.moved = true
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: true })

  // ── Resize ────────────────────────────────────────────────────────────────
  function onResize() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
  }
  window.addEventListener('resize', onResize)
  onResize()

  // ── Animation loop ────────────────────────────────────────────────────────
  const start = performance.now()
  let lastTime     = 0
  let lastIdleSplat = -999
  let rafId: number

  function animate() {
    rafId = requestAnimationFrame(animate)
    const t  = (performance.now() - start) * 0.001
    const dt = Math.min(t - lastTime, 0.033) // cap step to ~30 fps equivalent
    lastTime = t

    // Mouse-driven splat
    if (mouse.moved) {
      const dx = (mouse.px - mouse.x) * 60
      const dy = (mouse.py - mouse.y) * 60
      const [r, g, b] = cycleColor(t)
      doSplat(mouse.x, mouse.y, dx, dy, r, g, b)
      mouse.moved = false
    }

    // Idle splat on lissajous path — keeps field alive without mouse input
    if (t - lastIdleSplat > 1.1) {
      lastIdleSplat = t
      const ix = Math.random()
      const iy = Math.random()
      const [r, g, b] = cycleColor(t)
      doSplat(ix, iy, Math.cos(t * 1.7) * 10, Math.sin(t * 1.3) * 10,
              r * 0.85, g * 0.85, b * 0.85)
    }

    stepCurl()
    stepVorticity(dt)
    stepAdvectVelocity(dt)
    stepDivergence()
    stepPressure()
    stepGradient()
    stepBoundary()
    stepAdvectDye(dt)
    stepDisplay()
  }
  animate()

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('resize', onResize)
    gl!.deleteVertexArray(vao)
    gl!.deleteBuffer(quadBuf)
  }
}
