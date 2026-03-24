/**
 * Background switcher — flow field ↔ fractal ↔ fluid.
 *
 * Three canvases are stacked. The active one is fully opaque; the others fade out.
 * The navbar toggle button cycles through all three modes.
 *
 * Icons (current mode shown on button):
 *   flow    〰️   Canvas 2D particle flow field
 *   fractal ◉   Julia set with orbit-trap coloring
 *   fluid   ≋   Navier-Stokes fluid with cycling colours
 */
import { initFlowField } from './flowfield'
import { initFractal }   from './fractal'
import { initFluid }     from './fluid'

type Mode = 'flow' | 'fractal' | 'fluid'

const FADE_MS = 800

const MODES: Mode[]          = ['flow', 'fractal', 'fluid']
const ICONS: Record<Mode, string> = { flow: '〰️', fractal: '◉', fluid: '≋' }
const TITLES: Record<Mode, string> = {
  flow:    'Flow field',
  fractal: 'Julia orbit trap',
  fluid:   'Fluid sim',
}

function makeCanvas(id: string, ref: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.id = id
  c.style.cssText = ref.style.cssText
  c.style.opacity    = '0'
  c.style.transition = `opacity ${FADE_MS}ms ease`
  return c
}

export function initBackground(): void {
  // ── Canvas setup ──────────────────────────────────────────────────────
  const flowCanvas   = document.getElementById('mesh-canvas') as HTMLCanvasElement
  flowCanvas.id      = 'flow-canvas'
  flowCanvas.style.transition = `opacity ${FADE_MS}ms ease`

  const fractalCanvas = makeCanvas('fractal-canvas', flowCanvas)
  const fluidCanvas   = makeCanvas('fluid-canvas',   flowCanvas)

  const parent = flowCanvas.parentNode!
  parent.insertBefore(fractalCanvas, flowCanvas)
  parent.insertBefore(fluidCanvas,   flowCanvas)

  // ── Engines ───────────────────────────────────────────────────────────
  const cleanupFlow    = initFlowField(flowCanvas)
  const cleanupFractal = initFractal(fractalCanvas)
  const cleanupFluid   = initFluid(fluidCanvas)

  // ── Canvases map ──────────────────────────────────────────────────────
  const canvases: Record<Mode, HTMLCanvasElement> = {
    flow:    flowCanvas,
    fractal: fractalCanvas,
    fluid:   fluidCanvas,
  }

  // ── Toggle button ─────────────────────────────────────────────────────
  const btn = document.getElementById('bg-toggle') as HTMLButtonElement

  btn.addEventListener('mouseenter', () => {
    btn.style.borderColor = 'rgba(180,79,255,0.8)'
    btn.style.boxShadow   = '0 0 16px rgba(180,79,255,0.4)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = 'rgba(180,79,255,0.35)'
    btn.style.boxShadow   = 'none'
  })
  btn.addEventListener('click', () => {
    const next = MODES[(MODES.indexOf(current) + 1) % MODES.length]!
    switchTo(next)
  })

  // ── State ─────────────────────────────────────────────────────────────
  let current: Mode = 'flow'
  updateBtn()

  function switchTo(mode: Mode) {
    if (mode === current) return
    canvases[current].style.opacity = '0'
    current = mode
    canvases[current].style.opacity = '1'
    updateBtn()
  }

  function updateBtn() {
    btn.textContent = ICONS[current]
    btn.title = TITLES[current]
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    cleanupFlow()
    cleanupFractal()
    cleanupFluid()
  })
}
