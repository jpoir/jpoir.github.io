/**
 * Floating credential badges.
 * Each badge drifts on a slow sinusoidal path and pulses gently.
 * Implemented as absolutely-positioned DOM elements inside the hero section
 * so they stay contained and don't overlap the navbar or other sections.
 */

interface Badge {
  label: string
  color: string   // Tailwind-style inline color token
  delay: number   // animation delay in seconds
  x: string       // CSS left (%)
  y: string       // CSS top  (%)
}

const BADGES: Badge[] = [
  { label: 'DEFCON CTF Designer', color: '#ff44cc', delay: 0,    x: '6%',  y: '22%' },
  { label: 'HICSS 2024',          color: '#44ccff', delay: 1.2,  x: '78%', y: '18%' },
  { label: 'Stanford ML',         color: '#b44fff', delay: 0.6,  x: '82%', y: '72%' },
  { label: 'BlackHat 2023',       color: '#ff44cc', delay: 1.8,  x: '5%',  y: '70%' },
  { label: 'Patent Pending',      color: '#44ccff', delay: 2.4,  x: '88%', y: '44%' },
  { label: 'AI-ISAC 2024',        color: '#b44fff', delay: 0.9,  x: '3%',  y: '46%' },
]

export function initBadges(): void {
  const hero = document.getElementById('hero')
  if (!hero) return

  // Hero needs relative positioning — add if not already set
  hero.style.position = 'relative'

  BADGES.forEach(badge => {
    const el = document.createElement('div')
    el.className = 'floating-badge'
    el.textContent = badge.label
    el.style.cssText = `
      position: absolute;
      left: ${badge.x};
      top: ${badge.y};
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.7rem;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid ${badge.color}55;
      background: ${badge.color}12;
      color: ${badge.color};
      white-space: nowrap;
      pointer-events: none;
      z-index: 2;
      animation: badge-float ${4.5 + badge.delay * 0.4}s ease-in-out ${badge.delay}s infinite;
      opacity: 0;
      animation-fill-mode: forwards;
    `
    hero.appendChild(el)
  })
}
