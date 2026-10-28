import { useEffect, useRef, useState } from 'react'

const SpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings to answer by voice.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser settings to answer by voice.',
  'audio-capture': "No microphone was found. You can type your answer instead.",
  network: "Voice input needs an internet connection in this browser. You can type your answer instead.",
}

// Dictation via the browser's Web Speech API. `start(baseText, onText)` keeps
// whatever was already typed and appends what the user says after it.
export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const start = (baseText, onText) => {
    if (!SpeechRecognition || listening) return
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event) => {
      let spoken = ''
      for (const result of event.results) spoken += result[0].transcript
      onText([baseText.trim(), spoken.trim()].filter(Boolean).join(' '))
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      setError(ERROR_MESSAGES[event.error] || "Voice input stopped unexpectedly. You can try again or type instead.")
    }
    recognition.onend = () => setListening(false)

    setError('')
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const stop = () => recognitionRef.current?.stop()

  return { supported: Boolean(SpeechRecognition), listening, error, start, stop }
}
