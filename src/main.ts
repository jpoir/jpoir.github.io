import './style.css'
import { initBackground } from './background'
import { initNav } from './nav'
import { initAnimations } from './animations'
import { initResumeDownload } from './resume'
import { initTerminal } from './terminal'

document.addEventListener('DOMContentLoaded', () => {
  initBackground()
  initNav()
  initAnimations()
  initResumeDownload()
  initTerminal()

  // Typed headline cycling
  const roles = [
    'Principal AI Engineer',
    'Security Researcher',
    'ML Systems Architect',
    'Patent-Holding Inventor',
  ]
  const typeTarget = document.getElementById('typed-role') as HTMLElement
  let ri = 0
  let ci = 0
  let deleting = false

  function type() {
    const current = roles[ri]
    if (!deleting) {
      typeTarget.textContent = current.slice(0, ++ci)
      if (ci === current.length) {
        deleting = true
        setTimeout(type, 2200)
        return
      }
      setTimeout(type, 70)
    } else {
      typeTarget.textContent = current.slice(0, --ci)
      if (ci === 0) {
        deleting = false
        ri = (ri + 1) % roles.length
        setTimeout(type, 400)
        return
      }
      setTimeout(type, 35)
    }
  }

  type()
})
