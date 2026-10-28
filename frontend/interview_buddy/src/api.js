const API_BASE = 'http://127.0.0.1:8000'

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error("Couldn't reach the server. Is the backend running?")
  }

  if (!res.ok) {
    let message = `Something went wrong (error ${res.status}). Please try again.`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new Error(message)
  }
  return res
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

export function getHistory() {
  return request('/history').then((res) => res.json())
}

export function rateSession(sessionId, confidence) {
  return post(`/history/${sessionId}/confidence`, { confidence })
}

export async function streamText(response, onChunk) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    let chunk
    try {
      chunk = await reader.read()
    } catch {
      throw new Error('Lost connection to the coach partway through. Please try again.')
    }
    if (chunk.done) break
    full += decoder.decode(chunk.value, { stream: true })
    onChunk(full)
  }
  return full
}
