/**
 * JS-gated resume download.
 *
 * The PDF path is never in the HTML — it only exists in the compiled JS bundle.
 * The button fetches the file at click-time, creates a temporary blob URL,
 * triggers a download, then immediately revokes the URL.
 * Basic scrapers that don't execute JS cannot access the file.
 */

// Obfuscated path — split so it's not a single searchable string in the bundle
const R = ['/', 'assets', '/', 'res', 'ume.pdf'].join('')

export function initResumeDownload(): void {
  const buttons = document.querySelectorAll<HTMLElement>('[data-resume-download]')

  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault()

      const original = btn.textContent
      btn.textContent = 'Preparing...'
      btn.setAttribute('aria-disabled', 'true')

      try {
        const res = await fetch(R)
        if (!res.ok) throw new Error('fetch failed')

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = 'James_Poirier_Resume.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Revoke immediately — blob URL is single-use
        setTimeout(() => URL.revokeObjectURL(url), 100)
      } catch {
        alert('Unable to download resume. Please try again.')
      } finally {
        btn.textContent = original
        btn.removeAttribute('aria-disabled')
      }
    })
  })
}
