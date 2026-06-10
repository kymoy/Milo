import { useState } from 'react'
import { sendMessage } from '../utils/chat'

const BACKEND = 'http://localhost:8000'
const MAX_LENGTH = 2000

async function persistSession(sessionId, messages) {
  // Skip the greeting (index 0) — it's synthetic per-theme text
  const toSave = messages.slice(1).map(({ role, text }) => ({ role, text }))
  if (toSave.length === 0) return

  // Persist response times locally (backend only stores role+text)
  const timings = messages.slice(1).map(m => m.metrics?.response_ms ?? null)
  localStorage.setItem(`milo_timings_${sessionId}`, JSON.stringify(timings))

  try {
    await fetch(`${BACKEND}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, messages: toSave }),
    })
  } catch {}
}

export function useMiloChat(greeting, useLibrary = true) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([{ role: 'bot', text: greeting }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX_LENGTH) return

    let sid = sessionId
    if (!sid) {
      sid = crypto.randomUUID()
      setSessionId(sid)
    }

    const isNewSession = messages.length === 1  // only greeting exists
    const history = [
      ...(isNewSession ? [{ role: 'system', text: '__reset_style__' }] : []),
      ...messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.text,
      })),
    ]

    const withUser = [...messages, { role: 'user', text }]
    setMessages(withUser)
    setInput('')
    setLoading(true)

    const { reply, metrics } = await sendMessage(text, useLibrary, history)
    const final = [...withUser, { role: 'bot', text: reply, metrics }]
    setMessages(final)
    setLoading(false)

    persistSession(sid, final)
  }

  function resetChat() {
    setSessionId(null)
    setMessages([{ role: 'bot', text: greeting }])
  }

  function loadSession(id, savedMessages) {
    const timings = JSON.parse(localStorage.getItem(`milo_timings_${id}`) || '[]')
    const withTimings = savedMessages.map((m, i) => {
      const ms = timings[i]
      return ms != null ? { ...m, metrics: { response_ms: ms } } : m
    })
    setSessionId(id)
    setMessages([{ role: 'bot', text: greeting }, ...withTimings])
  }

  return { messages, input, setInput, loading, send, resetChat, sessionId, loadSession }
}
