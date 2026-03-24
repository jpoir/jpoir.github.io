/**
 * Navbar behaviour:
 *   - Highlight the active section link as the user scrolls
 *   - Add a backdrop blur / border on scroll
 *   - Mobile hamburger toggle
 */
export function initNav(): void {
  const nav = document.getElementById('navbar') as HTMLElement
  const links = nav.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')
  const menuBtn = document.getElementById('menu-btn') as HTMLButtonElement
  const mobileMenu = document.getElementById('mobile-menu') as HTMLElement

  // ── Scroll: add border + blur ──────────────────────────────────────────
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      nav.classList.add('nav-scrolled')
    } else {
      nav.classList.remove('nav-scrolled')
    }
  })

  // ── Active section highlight ───────────────────────────────────────────
  const sectionIds = Array.from(links).map(l => l.getAttribute('href')?.replace('#', '') ?? '')

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id
          links.forEach(link => {
            const active = link.getAttribute('href') === `#${id}`
            link.classList.toggle('text-vapor-blue', active)
            link.classList.toggle('text-slate-400', !active)
          })
        }
      })
    },
    { rootMargin: '-40% 0px -55% 0px' }
  )

  sectionIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  })

  // ── Mobile menu toggle ─────────────────────────────────────────────────
  menuBtn.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('hidden')
    menuBtn.setAttribute('aria-expanded', String(!open))
  })

  // Close mobile menu on link click
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.add('hidden')
      menuBtn.setAttribute('aria-expanded', 'false')
    })
  })
}
