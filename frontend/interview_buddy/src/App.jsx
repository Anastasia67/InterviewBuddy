import { useState } from 'react'
import { startSession, sendAnswerAction, endSession, rateSession, streamText } from './api'
import { useSpeechRecognition } from './useSpeechRecognition'
import { CONFIDENCE_LABELS } from './confidence'
import BreathingPause from './BreathingPause'
import HistoryScreen from './HistoryScreen'
import './App.css'

const INITIAL_CONFIG = {
  track: 'behavioral',
  mode: 'quick',
  difficulty: 'gentle',
  role: '',
  company: '',
  breathing: false,
  showProgress: true,
}

function SetupScreen({ onStart, onViewProgress }) {
  const [config, setConfig] = useState(INITIAL_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (key) => (e) => setConfig({ ...config, [key]: e.target.value })
  const toggle = (key) => (e) => setConfig({ ...config, [key]: e.target.checked })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onStart(config)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="setup" onSubmit={handleSubmit}>
      <h1>InterviewBuddy</h1>
      <p>A low-pressure space to practice interviews. There's no timer. Take as long as you need.</p>

      <label>
        Track
        <select value={config.track} onChange={update('track')}>
          <option value="behavioral">Behavioral</option>
          <option value="technical">Technical</option>
        </select>
      </label>

      <label>
        Mode
        <select value={config.mode} onChange={update('mode')}>
          <option value="quick">Quick Q&A (feedback after each answer)</option>
          <option value="full">Full mock interview (feedback at the end)</option>
        </select>
      </label>

      <label>
        Difficulty
        <select value={config.difficulty} onChange={update('difficulty')}>
          <option value="gentle">Gentle</option>
          <option value="moderate">Moderate</option>
          <option value="challenging">Challenging</option>
        </select>
      </label>

      <label>
        Role you're preparing for (optional)
        <input
          type="text"
          placeholder="e.g. Frontend Engineer"
          value={config.role}
          onChange={update('role')}
        />
      </label>

      <label>
        Company you're interviewing with (optional)
        <input
          type="text"
          placeholder="e.g. Stripe"
          value={config.company}
          onChange={update('company')}
        />
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={config.breathing} onChange={toggle('breathing')} />
        Take a short breathing pause before each question
      </label>

      <label className="checkbox">
        <input type="checkbox" checked={config.showProgress} onChange={toggle('showProgress')} />
        Show question count (e.g. "Question 2 of 5")
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Starting…' : 'Start session'}
      </button>
      {loading && (config.role || config.company) && (
        <p className="hint">Tailoring questions to your role and company — this can take a few seconds…</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <button type="button" onClick={onViewProgress} className="link">
        View your progress
      </button>
    </form>
  )
}

function SessionScreen({ session, onSubmit, onSkip, onRetry, onNext, onEndEarly, onReady }) {
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const speech = useSpeechRecognition()
  const { mode, track, question, index, total, stage, feedback, showProgress } = session

  // Runs one action at a time; returns whether it succeeded.
  const run = async (action) => {
    speech.stop()
    setLoading(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  const submit = () => {
    if (!answerText.trim()) return
    run(() => onSubmit(answerText))
  }

  const skip = async () => {
    if (await run(onSkip)) setAnswerText('')
  }

  const next = async () => {
    if (await run(onNext)) setAnswerText('')
  }

  const endEarly = () => run(onEndEarly)

  const toggleVoice = () => {
    if (speech.listening) speech.stop()
    else speech.start(answerText, setAnswerText)
  }

  return (
    <div className="session">
      {showProgress && (
        <p className="progress">
          Question {index + 1} of {total}
        </p>
      )}

      {stage === 'breathing' ? (
        <BreathingPause onDone={onReady} />
      ) : (
        <h2>{question}</h2>
      )}

      {stage === 'answering' && (
        <>
          <p className="hint">
            Pausing to think is completely normal.
            {track === 'behavioral' && ' Try walking through the Situation, Task, Action and Result.'}
          </p>
          <textarea
            rows={6}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder={speech.supported ? 'Type your answer, or answer out loud with the mic…' : 'Type your answer…'}
            disabled={loading}
            readOnly={speech.listening}
            aria-label="Your answer"
          />
          {speech.listening && (
            <p className="listening" aria-live="polite">
              <span className="listening-dot" aria-hidden="true" /> Listening… speak whenever you're ready.
            </p>
          )}
          {speech.error && <p className="error" role="alert">{speech.error}</p>}
          <div className="actions">
            <button onClick={submit} disabled={loading || !answerText.trim()}>
              Submit answer
            </button>
            {speech.supported && (
              <button
                onClick={toggleVoice}
                disabled={loading}
                className={speech.listening ? 'secondary active' : 'secondary'}
                aria-pressed={speech.listening}
              >
                {speech.listening ? 'Stop speaking' : 'Answer out loud'}
              </button>
            )}
            <button onClick={skip} disabled={loading} className="secondary">
              Skip
            </button>
          </div>
        </>
      )}

      {stage === 'reviewing' && (
        <>
          {mode === 'quick' ? (
            <div className="feedback" aria-live="polite" aria-busy={loading}>
              {feedback || '…'}
            </div>
          ) : (
            <div className="feedback ack" aria-live="polite">Answer recorded.</div>
          )}
          <div className="actions">
            <button onClick={next} disabled={loading}>
              {index + 1 >= total ? 'Finish' : 'Next question'}
            </button>
            <button onClick={onRetry} disabled={loading} className="secondary">
              Retry this answer
            </button>
          </div>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <button onClick={endEarly} disabled={loading} className="link">
        End session now
      </button>
    </div>
  )
}

function ConfidenceCheckIn({ onRate }) {
  const [rating, setRating] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const choose = async (value) => {
    setSaving(true)
    setError('')
    try {
      await onRate(value)
      setRating(value)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (rating) {
    return <p className="hint" role="status">Thanks — saved to your progress.</p>
  }

  return (
    <fieldset className="check-in">
      <legend>How confident do you feel after this session?</legend>
      <div className="rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" className="secondary" onClick={() => choose(value)} disabled={saving}>
            <span className="rating-value">{value}</span>
            <span className="rating-label">{CONFIDENCE_LABELS[value]}</span>
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </fieldset>
  )
}

function SummaryScreen({ summary, error, done, canRate, onRate, onRestart, onViewProgress }) {
  return (
    <div className="summary">
      <h1>Session summary</h1>
      {(summary || !error) && (
        <div className="summary-text" aria-live="polite" aria-busy={!done}>
          {summary || '…'}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {done && canRate && !error && <ConfidenceCheckIn onRate={onRate} />}
      <div className="actions">
        <button onClick={onRestart}>Start another session</button>
        <button onClick={onViewProgress} className="secondary">
          View your progress
        </button>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('setup')
  const [sessionId, setSessionId] = useState(null)
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [summaryDone, setSummaryDone] = useState(false)
  const [canRate, setCanRate] = useState(false)

  const firstStage = (s) => (s.breathing ? 'breathing' : 'answering')

  const handleStart = async (config) => {
    const { breathing, showProgress, ...sessionConfig } = config
    const data = await startSession(sessionConfig)
    setSessionId(data.session_id)
    setSession({
      mode: config.mode,
      track: config.track,
      breathing,
      showProgress,
      question: data.question,
      index: data.index,
      total: data.total,
      stage: breathing ? 'breathing' : 'answering',
      feedback: '',
    })
    setScreen('session')
  }

  const goToSummary = async () => {
    const res = await endSession(sessionId)
    // The backend only saves sessions where at least one question was answered or skipped.
    setCanRate(session.index > 0 || session.stage === 'reviewing')
    setSummary('')
    setSummaryError('')
    setSummaryDone(false)
    setScreen('summary')
    try {
      if (session.mode === 'full') {
        await streamText(res, setSummary)
      } else {
        const data = await res.json()
        setSummary(data.summary)
      }
    } catch (err) {
      setSummaryError(err.message)
    } finally {
      setSummaryDone(true)
    }
  }

  const advance = async (res) => {
    const meta = await res.json()
    if (meta.done) {
      await goToSummary()
      return
    }
    setSession((s) => ({
      ...s,
      question: meta.question,
      index: meta.index,
      total: meta.total,
      stage: firstStage(s),
      feedback: '',
    }))
  }

  const handleReady = () => {
    setSession((s) => ({ ...s, stage: 'answering' }))
  }

  const handleSubmit = async (answerText) => {
    const res = await sendAnswerAction({ sessionId, action: 'answer', answer: answerText })
    // Show the reviewing panel right away so quick-mode feedback is visible as it streams.
    setSession((s) => ({ ...s, stage: 'reviewing', feedback: '' }))
    if (session.mode === 'quick') {
      try {
        await streamText(res, (partial) => setSession((s) => ({ ...s, feedback: partial })))
      } catch (err) {
        setSession((s) => ({ ...s, stage: 'answering', feedback: '' }))
        throw err
      }
    }
  }

  const handleSkip = async () => {
    const res = await sendAnswerAction({ sessionId, action: 'skip' })
    await advance(res)
  }

  const handleRetry = () => {
    setSession((s) => ({ ...s, stage: 'answering', feedback: '' }))
  }

  const handleNext = async () => {
    const res = await sendAnswerAction({ sessionId, action: 'next' })
    await advance(res)
  }

  const handleRate = (confidence) => rateSession(sessionId, confidence)

  const handleRestart = () => {
    setSessionId(null)
    setSession(null)
    setSummary('')
    setSummaryError('')
    setSummaryDone(false)
    setScreen('setup')
  }

  return (
    <section id="center">
      {screen === 'setup' && <SetupScreen onStart={handleStart} onViewProgress={() => setScreen('history')} />}
      {screen === 'session' && session && (
        <SessionScreen
          session={session}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          onRetry={handleRetry}
          onNext={handleNext}
          onEndEarly={goToSummary}
          onReady={handleReady}
        />
      )}
      {screen === 'summary' && (
        <SummaryScreen
          summary={summary}
          error={summaryError}
          done={summaryDone}
          canRate={canRate}
          onRate={handleRate}
          onRestart={handleRestart}
          onViewProgress={() => setScreen('history')}
        />
      )}
      {screen === 'history' && <HistoryScreen onBack={handleRestart} />}
    </section>
  )
}

export default App
