import { useEffect, useState } from 'react'

const PHASES = ['Breathe in…', 'Breathe out…', 'Breathe in…', 'Breathe out…']
const PHASE_MS = 4000

// Two slow breaths before a question appears. The circle animation (App.css)
// runs on the same 8-second cycle as the labels.
function BreathingPause({ onDone }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (phase + 1 >= PHASES.length) onDone()
      else setPhase(phase + 1)
    }, PHASE_MS)
    return () => clearTimeout(timer)
  }, [phase, onDone])

  return (
    <div className="breathing">
      <div className="breath-circle" aria-hidden="true" />
      <p className="breath-label" aria-live="polite">
        {PHASES[phase]}
      </p>
      <p className="hint">Your next question is ready whenever you are.</p>
      <button onClick={onDone} className="secondary">
        I'm ready
      </button>
    </div>
  )
}

export default BreathingPause
