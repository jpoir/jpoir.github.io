/**
 * Flow field background — canvas 2D.
 *
 * Perlin noise directs particles. The mouse repels nearby particles.
 * Section dividers act as magnetic attractor bands: particles within
 * ATTRACTOR_RADIUS of a band's viewport-Y are gently bent horizontal
 * and pulled toward the band, creating a visible streaming river effect.
 */

// ── Perlin noise (2D) ─────────────────────────────────────────────────────
const perm = new Uint8Array(512)
const grad2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1],  [0, -1],
]

function setupPerm(): void {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
}

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a: number, b: number, t: number): number { return a + t * (b - a) }

function noise(x: number, y: number): number {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  const u = fade(x)
  const v = fade(y)
  const g00 = grad2[perm[perm[X]     + Y]     & 7]!
  const g10 = grad2[perm[perm[X + 1] + Y]     & 7]!
  const g01 = grad2[perm[perm[X]     + Y + 1] & 7]!
  const g11 = grad2[perm[perm[X + 1] + Y + 1] & 7]!
  return lerp(
    lerp(g00[0]! * x + g00[1]! * y,       g10[0]! * (x - 1) + g10[1]! * y,       u),
    lerp(g01[0]! * x + g01[1]! * (y - 1), g11[0]! * (x - 1) + g11[1]! * (y - 1), u),
    v,
  )
}

// ── Palette ───────────────────────────────────────────────────────────────
const COLORS = [
  'rgba(180, 79, 255,',   // vapor-purple
  'rgba(255, 68, 204,',   // vapor-pink
  'rgba(68,  204, 255,',  // vapor-blue
  'rgba(102, 85, 255,',   // vapor-indigo
]

// ── Particle ──────────────────────────────────────────────────────────────
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  color: string
  alpha: number
  life: number
  maxLife: number
}

function makeParticle(w: number, h: number): Particle {
  const maxLife = 180 + Math.random() * 220
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    speed: 0.5 + Math.random() * 0.8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    alpha: 0.55 + Math.random() * 0.35,
    life: Math.floor(Math.random() * maxLife),
    maxLife,
  }
}

// ── Attractor band helpers ────────────────────────────────────────────────
const ATTRACTOR_RADIUS   = 90    // px around band where pull begins
const ATTRACTOR_STRENGTH = 0.28  // max blend toward horizontal (0–1)

/** Returns viewport-Y of each .section-divider mid-point. */
function getAttractorYs(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.section-divider'))
    .map(el => {
      const r = el.getBoundingClientRect()
      return r.top + r.height * 0.5
    })
    .filter(y => y > -ATTRACTOR_RADIUS && y < window.innerHeight + ATTRACTOR_RADIUS)
}

// ── Main export ───────────────────────────────────────────────────────────
export function initFlowField(canvas: HTMLCanvasElement): () => void {
  setupPerm()

  const ctx = canvas.getContext('2d')!

  // ── Mouse ────────────────────────────────────────────────────────────
  const mouse = { x: -9999, y: -9999 }
  const MOUSE_RADIUS   = 260
  const MOUSE_STRENGTH = 5.5

  function onMouseMove(e: MouseEvent) { mouse.x = e.clientX; mouse.y = e.clientY }
  function onTouchMove(e: TouchEvent) {
    mouse.x = e.touches[0]!.clientX
    mouse.y = e.touches[0]!.clientY
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('touchmove', onTouchMove, { passive: true })

  // ── Resize ───────────────────────────────────────────────────────────
  let W = 0, H = 0

  function resize() {
    W = window.innerWidth
    H = window.innerHeight
    canvas.width  = W
    canvas.height = H
    ctx.fillStyle = '#07071a'
    ctx.fillRect(0, 0, W, H)
  }
  window.addEventListener('resize', resize)
  resize()

  // ── Particles ────────────────────────────────────────────────────────
  const COUNT = 3000
  const particles: Particle[] = Array.from({ length: COUNT }, () => makeParticle(W, H))

  // ── Noise params ─────────────────────────────────────────────────────
  const SCALE   = 0.0025
  const Z_SPEED = 0.00010
  let   zOff    = 0

  // ── Animation loop ────────────────────────────────────────────────────
  let rafId: number

  function animate() {
    rafId = requestAnimationFrame(animate)
    zOff += Z_SPEED

    // Sample attractor positions every frame (they shift on scroll)
    const attractorYs = getAttractorYs()

    ctx.fillStyle = 'rgba(7, 7, 26, 0.18)'
    ctx.fillRect(0, 0, W, H)

    for (const p of particles) {
      // Base noise angle
      const angle = noise(p.x * SCALE, p.y * SCALE + zOff) * Math.PI * 4

      // ── Mouse repulsion ─────────────────────────────────────────────
      const mdx = p.x - mouse.x
      const mdy = p.y - mouse.y
      const dist2 = mdx * mdx + mdy * mdy
      const inMouse = dist2 < MOUSE_RADIUS * MOUSE_RADIUS && dist2 > 0.01
      const mouseProximity = inMouse ? 1 - Math.sqrt(dist2) / MOUSE_RADIUS : 0
      const mouseAngle = inMouse ? Math.atan2(mdy, mdx) : angle

      let finalAngle = inMouse
        ? angle + (mouseAngle - angle) * MOUSE_STRENGTH * mouseProximity
        : angle

      // ── Attractor bands ─────────────────────────────────────────────
      // Find the nearest attractor band
      let maxPull = 0
      let pullAngle = finalAngle

      for (const ay of attractorYs) {
        const dy   = p.y - ay
        const dist = Math.abs(dy)
        if (dist < ATTRACTOR_RADIUS) {
          // Influence: strongest at band centre, zero at edge
          const t = 1 - dist / ATTRACTOR_RADIUS
          const pull = t * t * ATTRACTOR_STRENGTH   // ease-in so pull is subtle far out

          if (pull > maxPull) {
            maxPull = pull
            // Target: flow horizontally in the direction the particle is already moving
            const horizontalAngle = (Math.cos(finalAngle) >= 0) ? 0 : Math.PI
            // Also gently draw vertically toward the band centre
            const towardBand = Math.atan2(-dy * 0.4, Math.abs(Math.cos(finalAngle)) * 200 + 1)
            pullAngle = finalAngle + (horizontalAngle + towardBand - finalAngle) * pull
          }
        }
      }

      finalAngle = maxPull > 0 ? pullAngle : finalAngle

      // ── Velocity ────────────────────────────────────────────────────
      const speedMul = 1 + mouseProximity * 3
      p.vx = Math.cos(finalAngle) * p.speed * speedMul
      p.vy = Math.sin(finalAngle) * p.speed * speedMul

      const px = p.x
      const py = p.y
      p.x += p.vx
      p.y += p.vy
      p.life++

      // Life-based alpha fade
      const lifeRatio = p.life / p.maxLife
      const fadeAlpha = lifeRatio > 0.8
        ? p.alpha * (1 - (lifeRatio - 0.8) / 0.2)
        : p.alpha

      // Brighten slightly when caught in an attractor band
      const bandAlpha = fadeAlpha * (1 + maxPull * 0.6)

      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(p.x, p.y)
      ctx.strokeStyle = p.color + Math.min(bandAlpha, 1) + ')'
      ctx.lineWidth = maxPull > 0.1 ? 1.4 : 1.1
      ctx.stroke()

      if (
        p.life >= p.maxLife ||
        p.x < -10 || p.x > W + 10 ||
        p.y < -10 || p.y > H + 10
      ) {
        Object.assign(p, makeParticle(W, H))
      }
    }
  }

  animate()

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('resize', resize)
  }
}
