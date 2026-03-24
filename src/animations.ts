/**
 * Scroll-triggered fade-in-up animations using IntersectionObserver.
 * Add [data-animate] to any element to opt in.
 */
export function initAnimations(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-animate]')

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset['animateDelay'] ?? '0'
          el.style.animationDelay = `${delay}ms`
          el.classList.add('animate-fade-in-up')
          el.style.opacity = '1'
          observer.unobserve(el)
        }
      })
    },
    { threshold: 0.12 }
  )

  targets.forEach(el => {
    el.style.opacity = '0'
    observer.observe(el)
  })
}
