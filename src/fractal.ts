/**
 * Julia set with orbit-trap coloring — full-screen WebGL shader.
 *
 * The Julia parameter c animates slowly around the boundary of the main
 * cardioid; the mouse nudges it interactively.  Three orbit traps (point,
 * cross, circle) are blended to produce the vaporwave palette.
 *
 * Returns a cleanup function.
 */

const VS = /* glsl */`
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FS = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;

  const int MAX_ITER = 80;

  // ── Orbit traps ──────────────────────────────────────────────────────────
  float trapPoint(vec2 z)  { return length(z); }
  float trapCross(vec2 z)  { return min(abs(z.x), abs(z.y)); }
  float trapCircle(vec2 z) { return abs(length(z) - 0.75); }

  // ── Vaporwave palette ────────────────────────────────────────────────────
  vec3 vaporPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 dark   = vec3(0.027, 0.027, 0.102); // #07071a
    vec3 purple = vec3(0.706, 0.310, 1.000); // #b44fff
    vec3 pink   = vec3(1.000, 0.267, 0.800); // #ff44cc
    vec3 blue   = vec3(0.267, 0.800, 1.000); // #44ccff
    if (t < 0.40) return mix(dark,   purple, t / 0.40);
    if (t < 0.70) return mix(purple, pink,   (t - 0.40) / 0.30);
    return             mix(pink,   blue,   (t - 0.70) / 0.30);
  }

  void main() {
    // ── Map pixel → complex plane ─────────────────────────────────────────
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

    // ── Animate Julia c around the cardioid boundary ──────────────────────
    float st = uTime * 0.07;
    vec2 c = vec2(
      -0.70 + 0.22 * cos(st * 0.71 + 1.00),
       0.27 + 0.13 * sin(st * 0.53 + 0.40)
    );

    // Mouse subtly shifts c (clamped so it stays in interesting territory)
    vec2 mNorm = uMouse / uRes - 0.5;          // -0.5 … 0.5
    c += clamp(mNorm, -0.5, 0.5) * 0.10;

    // ── Gentle zoom drift ─────────────────────────────────────────────────
    float zoom = 1.30 + 0.22 * sin(uTime * 0.035);
    vec2 z = uv * zoom;

    // ── Iterate z → z² + c with orbit-trap accumulation ──────────────────
    float tp = 1e9, tc = 1e9, tr = 1e9;
    bool escaped = false;

    for (int i = 0; i < MAX_ITER; i++) {
      z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;

      tp = min(tp, trapPoint(z));
      tc = min(tc, trapCross(z));
      tr = min(tr, trapCircle(z));

      if (dot(z, z) > 16.0) { escaped = true; break; }
    }

    // Interior (Julia set body) rendered very dark so its silhouette reads
    float shade = escaped ? 1.0 : 0.18;

    // ── Map trap distances → [0, 1] ───────────────────────────────────────
    float fp = 1.0 - exp(-tp * 1.60);
    float fc = 1.0 - exp(-tc * 5.00);
    float fr = 1.0 - exp(-tr * 3.80);

    // ── Three color layers ────────────────────────────────────────────────
    vec3 col1 = vaporPalette(fp);
    vec3 col2 = vaporPalette(fract(fc + 0.36));
    vec3 col3 = vaporPalette(fract(fr + 0.62));

    vec3 final = col1 * 0.55 + col2 * 0.28 + col3 * 0.17;

    // Vignette so edges fade to near-black
    float vig = 1.0 - smoothstep(0.55, 1.40, length(uv));
    final *= vig;

    // Atmospheric dampening + interior shade
    final *= 0.44 * shade;

    gl_FragColor = vec4(final, 1.0);
  }
`

export function initFractal(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl', { alpha: false }) as WebGLRenderingContext | null
  if (!gl) return () => {}

  function compile(type: number, src: string): WebGLShader {
    const s = gl!.createShader(type)!
    gl!.shaderSource(s, src)
    gl!.compileShader(s)
    return s
  }

  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS))
  gl.linkProgram(prog)
  gl.useProgram(prog)

  // Full-screen triangle-strip quad
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
    gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uTime  = gl.getUniformLocation(prog, 'uTime')
  const uRes   = gl.getUniformLocation(prog, 'uRes')
  const uMouse = gl.getUniformLocation(prog, 'uMouse')

  const mouse = { x: 0, y: 0 }
  function onMouseMove(e: MouseEvent) { mouse.x = e.clientX; mouse.y = e.clientY }
  function onTouchMove(e: TouchEvent) {
    mouse.x = e.touches[0]!.clientX
    mouse.y = e.touches[0]!.clientY
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: true })

  function onResize() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.uniform2f(uRes, canvas.width, canvas.height)
  }
  window.addEventListener('resize', onResize)
  onResize()

  // Centre mouse so initial frame has no warp offset
  mouse.x = window.innerWidth  * 0.5
  mouse.y = window.innerHeight * 0.5

  const start = performance.now()
  let rafId: number

  function animate() {
    rafId = requestAnimationFrame(animate)
    gl!.uniform1f(uTime, (performance.now() - start) * 0.001)
    gl!.uniform2f(uMouse, mouse.x, mouse.y)
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
  }
  animate()

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('resize', onResize)
    gl!.deleteProgram(prog)
    gl!.deleteBuffer(buf)
  }
}
