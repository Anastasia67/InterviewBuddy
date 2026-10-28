import { useEffect, useState } from 'react'
import { getHistory } from './api'
import { CONFIDENCE_LABELS } from './confidence'

const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

function confidenceTrend(rated) {
  // `rated` is oldest first. Compare the first few check-ins with the latest few.
  if (rated.length < 4) return null
  const size = Math.min(3, Math.floor(rated.length / 2))
  const before = average(rated.slice(0, size).map((s) => s.confidence))
  const after = average(rated.slice(-size).map((s) => s.confidence))
  if (after > before) {
    return `Your confidence has grown from ${before.toFixed(1)} to ${after.toFixed(1)} out of 5. That's real progress.`
  }
  return 'Confidence goes up and down — showing up to practice is what counts.'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function HistoryScreen({ onBack }) {
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch((err) => setError(err.message))
  }, [])

  const rated = (history || []).filter((s) => s.confidence).reverse()
  const answeredTotal = (history || []).reduce((sum, s) => sum + s.answered, 0)
  const trend = confidenceTrend(rated)

  return (
    <div className="history">
      <h1>Your progress</h1>

      {error && <p className="error" role="alert">{error}</p>}
      {!history && !error && <p className="hint">Loading…</p>}

      {history && history.length === 0 && (
        <p>No sessions yet. Your first practice session will show up here.</p>
      )}

      {history && history.length > 0 && (
        <>
          <div className="stats">
            <div className="stat">
              <span className="stat-value">{history.length}</span>
              <span className="stat-label">sessions practiced</span>
            </div>
            <div className="stat">
              <span className="stat-value">{answeredTotal}</span>
              <span className="stat-label">questions answered</span>
            </div>
          </div>

          {rated.length > 0 && (
            <div>
              <h2>Confidence after each session</h2>
              <div className="confidence-chart" role="img" aria-label={`Confidence ratings, oldest to newest: ${rated.slice(-12).map((s) => s.confidence).join(', ')} out of 5`}>
                {rated.slice(-12).map((s) => (
                  <div
                    key={s.id}
                    className="confidence-bar"
                    style={{ height: `${s.confidence * 20}%` }}
                    title={`${formatDate(s.ended_at)}: ${s.confidence}/5`}
                  />
                ))}
              </div>
              {trend && <p className="hint">{trend}</p>}
            </div>
          )}

          <h2>Past sessions</h2>
          <ul className="history-list">
            {history.map((s) => (
              <li key={s.id}>
                <details>
                  <summary>
                    <strong>{formatDate(s.ended_at)}</strong> · {s.track} · {s.difficulty}
                    {s.role && ` · ${s.role}`}
                    <span className="history-meta">
                      {s.answered} of {s.total} answered
                      {s.confidence && ` · felt ${CONFIDENCE_LABELS[s.confidence].toLowerCase()} confident`}
                    </span>
                  </summary>
                  <div className="summary-text">{s.summary || 'No summary saved.'}</div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      <button onClick={onBack}>Back</button>
    </div>
  )
}

export default HistoryScreen
