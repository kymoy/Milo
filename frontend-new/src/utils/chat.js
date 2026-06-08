const BACKEND = 'http://localhost:8000'
const TIMEOUT_MS = 120000 // 2 minutes — Ollama on CPU can be slow

export async function sendMessage(message) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    return data.reply ?? 'No response received.'
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') return 'The request timed out. The model may still be loading — try again in a moment.'
    return 'Could not reach the backend.'
  }
}

export async function loginRequest(username, password) {
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return { ok: res.ok, data: await res.json() }
}
