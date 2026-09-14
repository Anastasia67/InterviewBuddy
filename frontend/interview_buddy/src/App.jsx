import { useState } from 'react'
import { startSession, sendAnswerAction, endSession, streamText } from './api'
import './App.css'

const INITIAL_CONFIG = { track: 'behavioral', mode: 'quick', difficulty: 'gentle', role: '' }

function SetupScreen({ onStart }) {
  const [config, setConfig] = useState(INITIAL_CONFIG)
  const [loading, setLoading] = useState(false)

  const update = (key) => (e) => setConfig({ ...config, [key]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await onStart(config)
    setLoading(false)
  }

  return (
    <form className="setup" onSubmit={handleSubmit}>
      <h1>InterviewBuddy</h1>
      <p>A low-pressure space to practice interviews.</p>

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

      <button type="submit" disabled={loading}>
        {loading ? 'Starting…' : 'Start session'}
      </button>
    </form>
  )
}

function SessionScreen({ session, onSubmit, onSkip, onRetry, onNext, onEndEarly }) {
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const { mode, question, index, total, stage, feedback } = session

  const submit = async () => {
    if (!answerText.trim()) return
    setLoading(true)
    await onSubmit(answerText)
    setLoading(false)
  }

  const skip = async () => {
    setLoading(true)
    await onSkip()
    setLoading(false)
  }

  const next = async () => {
    setLoading(true)
    await onNext()
    setLoading(false)
    setAnswerText('')
  }

  return (
    <div className="session">
      <p className="progress">
        Question {index + 1} of {total}
      </p>
      <h2>{question}</h2>

      {stage === 'answering' && (
        <>
          <textarea
            rows={6}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Type your answer…"
            disabled={loading}
          />
          <div className="actions">
            <button onClick={submit} disabled={loading || !answerText.trim()}>
              Submit answer
            </button>
            <button onClick={skip} disabled={loading} className="secondary">
              Skip
            </button>
          </div>
        </>
      )}

      {stage === 'reviewing' && (
        <>
          {mode === 'quick' ? (
            <div className="feedback">{feedback || '…'}</div>
          ) : (
            <div className="feedback ack">Answer recorded.</div>
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

      <button onClick={onEndEarly} className="link">
        End session now
      </button>
    </div>
  )
}

function SummaryScreen({ summary, onRestart }) {
  return (
    <div className="summary">
      <h1>Session summary</h1>
      <div className="summary-text">{summary || '…'}</div>
      <button onClick={onRestart}>Start another session</button>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState('setup')
  const [sessionId, setSessionId] = useState(null)
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState('')

  const handleStart = async (config) => {
    const data = await startSession(config)
    setSessionId(data.session_id)
    setSession({
      mode: config.mode,
      question: data.question,
      index: data.index,
      total: data.total,
      stage: 'answering',
      feedback: '',
    })
    setScreen('session')
  }

  const goToSummary = async () => {
    const res = await endSession(sessionId)
    setSummary('')
    if (session.mode === 'full') {
      await streamText(res, setSummary)
    } else {
      const data = await res.json()
      setSummary(data.summary)
    }
    setScreen('summary')
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
      stage: 'answering',
      feedback: '',
    }))
  }

  const handleSubmit = async (answerText) => {
    const res = await sendAnswerAction({ sessionId, action: 'answer', answer: answerText })
    if (session.mode === 'quick') {
      setSession((s) => ({ ...s, feedback: '' }))
      await streamText(res, (partial) => setSession((s) => ({ ...s, feedback: partial })))
    }
    setSession((s) => ({ ...s, stage: 'reviewing' }))
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

  const handleRestart = () => {
    setSessionId(null)
    setSession(null)
    setSummary('')
    setScreen('setup')
  }

  return (
    <section id="center">
      {screen === 'setup' && <SetupScreen onStart={handleStart} />}
      {screen === 'session' && session && (
        <SessionScreen
          session={session}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          onRetry={handleRetry}
          onNext={handleNext}
          onEndEarly={goToSummary}
        />
      )}
      {screen === 'summary' && <SummaryScreen summary={summary} onRestart={handleRestart} />}
    </section>
  )
}

export default App
