const API_BASE = 'http://127.0.0.1:8000'

async function post(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function startSession(config) {
  return post('/session/start', config).then((res) => res.json())
}

export function sendAnswerAction({ sessionId, action, answer }) {
  return post('/session/answer', { session_id: sessionId, action, answer })
}

export function endSession(sessionId) {
  return post('/session/end', { session_id: sessionId })
}

export async function streamText(response, onChunk) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onChunk(full)
  }
  return full
}
