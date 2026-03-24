/**
 * Fake terminal that types out lines sequentially.
 * Triggered when the terminal scrolls into view.
 */

const LINES = [
  { prompt: '❯', text: 'python threat_intel_engine.py --mode=scan', color: 'text-vapor-blue' },
  { prompt: ' ', text: 'Initializing RAG pipeline... loading 14,203 FOSS packages', color: 'text-slate-400' },
  { prompt: ' ', text: 'Vulnerability graph built  [████████████████████]  100%', color: 'text-slate-400' },
  { prompt: ' ', text: 'Anomalous binary signatures detected: <span class="text-vapor-pink font-bold">3 critical</span>', color: 'text-slate-400' },
  { prompt: '❯', text: 'kubectl apply -f agent-pipeline.yaml', color: 'text-vapor-blue' },
  { prompt: ' ', text: 'agent_01 <span class="text-emerald-400">● online</span>  |  agent_02 <span class="text-emerald-400">● online</span>  |  agent_03 <span class="text-emerald-400">● online</span>', color: 'text-slate-400' },
  { prompt: '❯', text: 'status: all systems operational <span class="text-emerald-400">✓</span>', color: 'text-vapor-purple' },
]

const CHAR_DELAY  = 28   // ms per character
const LINE_PAUSE  = 380  // ms between lines
const START_DELAY = 400  // ms before first line

export function initTerminal(): void {
  const container = document.getElementById('terminal-output')
  if (!container) return

  let started = false

  const observer = new IntersectionObserver(entries => {
    if (entries[0]!.isIntersecting && !started) {
      started = true
      observer.disconnect()
      setTimeout(() => runTerminal(container), START_DELAY)
    }
  }, { threshold: 0.3 })

  const terminal = document.getElementById('terminal-card')
  if (terminal) observer.observe(terminal)
}

function runTerminal(container: HTMLElement): void {
  let lineIndex = 0

  function nextLine() {
    if (lineIndex >= LINES.length) return

    const line = LINES[lineIndex]!
    lineIndex++

    // Create the line element
    const row = document.createElement('div')
    row.className = 'flex gap-3 items-start'

    const promptEl = document.createElement('span')
    promptEl.className = 'text-vapor-purple flex-shrink-0 w-4'
    promptEl.textContent = line.prompt

    const textEl = document.createElement('span')
    textEl.className = `font-mono text-sm ${line.color}`

    // Blinking cursor while typing
    const cursor = document.createElement('span')
    cursor.className = 'animate-pulse text-vapor-pink'
    cursor.textContent = '▋'

    row.appendChild(promptEl)
    row.appendChild(textEl)
    row.appendChild(cursor)
    container.appendChild(row)

    // Scroll terminal to bottom
    const card = container.closest('.terminal-scroll') as HTMLElement | null
    if (card) card.scrollTop = card.scrollHeight

    // Strip HTML tags to get plain char count for typing speed
    const plainText = line.text.replace(/<[^>]+>/g, '')
    let charIndex = 0

    const typeChar = () => {
      charIndex++
      // Reveal up to charIndex chars of the raw HTML string proportionally
      const ratio = charIndex / plainText.length
      const sliceLen = Math.floor(ratio * line.text.length)
      textEl.innerHTML = line.text.slice(0, sliceLen)

      if (charIndex < plainText.length) {
        setTimeout(typeChar, CHAR_DELAY)
      } else {
        textEl.innerHTML = line.text
        cursor.remove()
        setTimeout(nextLine, LINE_PAUSE)
      }
    }

    typeChar()
  }

  nextLine()
}
