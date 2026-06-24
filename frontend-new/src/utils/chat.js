const BACKEND = 'http://localhost:8000'
const TIMEOUT_MS = 120000

export async function streamMessage(message, useLibrary = true, history = [], { onStatus, onToken, onDone, onError, onSources } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BACKEND}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, use_library: useLibrary, history }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const detail = data.detail
      const msg = Array.isArray(detail)
        ? detail.map(e => e.msg ?? 'validation error').join(', ')
        : (detail ?? 'Something went wrong.')
      onError?.(`Error: ${msg}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw)
          if (event.type === 'status') onStatus?.(event.message)
          else if (event.type === 'sources') onSources?.(event.names)
          else if (event.type === 'token') onToken?.(event.content)
          else if (event.type === 'done') onDone?.(event.metrics)
          else if (event.type === 'error') onError?.(event.message)
        } catch {}
      }
    }
  } catch (err) {
    clearTimeout(timer)
    onError?.(err.name === 'AbortError'
      ? 'The request timed out. The model may still be loading — try again in a moment.'
      : 'Could not reach the backend.')
  }
}

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
