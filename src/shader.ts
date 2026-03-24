/**
 * GLSL gradient-noise shader background.
 * Full-screen WebGL quad with domain-warped FBM noise in vaporwave palette.
 * Mouse warps the domain locally. Returns a cleanup function.
 */

const VS = /* glsl */`
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FS = /* glsl */`
  precision mediump float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash2(i),             f),
          dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
          dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2  shift = vec2(3.1, 1.7);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    uv.y = 1.0 - uv.y;
    float t = uTime * 0.10;

    // Mouse warp
    vec2 m = uMouse / uRes;
    m.y = 1.0 - m.y;
    vec2 diff  = uv - m;
    float mLen = length(diff);
    vec2 mWarp = normalize(diff + 0.001) * exp(-mLen * 3.5) * 0.18;

    // Domain warp — two layers of FBM
    vec2 q = vec2(fbm(uv * 2.2 + t),
                  fbm(uv * 2.2 + vec2(5.2, 1.3) + t * 0.7));
    vec2 r = vec2(fbm(uv * 1.8 + q + vec2(1.7, 9.2) + t * 0.55),
                  fbm(uv * 1.8 + q + vec2(8.3, 2.8) + t * 0.45));

    float f = fbm((uv + r + mWarp) * 2.2);
    f = f * 0.5 + 0.5;

    // Vaporwave palette
    vec3 dark   = vec3(0.027, 0.027, 0.102); // #07071a
    vec3 purple = vec3(0.706, 0.310, 1.000); // #b44fff
    vec3 pink   = vec3(1.000, 0.267, 0.800); // #ff44cc
    vec3 blue   = vec3(0.267, 0.800, 1.000); // #44ccff

    vec3 col = mix(dark,   purple, smoothstep(0.25, 0.70, f));
    col = mix(col, pink,   smoothstep(0.55, 0.88, f) * 0.65);
    col = mix(col, blue,   smoothstep(0.10, 0.45, fbm(uv * 3.2 - t * 0.35)) * 0.40);

    col *= 0.38; // keep it atmospheric, not blinding

    gl_FragColor = vec4(col, 1.0);
  }
`

export function initShader(canvas: HTMLCanvasElement): () => void {
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

  // Full-screen triangle strip quad
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
