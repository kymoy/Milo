const BACKEND = 'http://localhost:8000'
const TIMEOUT_MS = 120000

export async function sendMessage(message, useLibrary = true, history = []) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${BACKEND}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, use_library: useLibrary, history }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    if (!res.ok) return { reply: `Error: ${data.detail ?? 'Something went wrong.'}`, metrics: null }
    return { reply: data.reply ?? 'No response received.', metrics: data.metrics ?? null }
  } catch (err) {
    clearTimeout(timer)
    const msg = err.name === 'AbortError'
      ? 'The request timed out. The model may still be loading — try again in a moment.'
      : 'Could not reach the backend.'
    return { reply: msg, metrics: null }
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
