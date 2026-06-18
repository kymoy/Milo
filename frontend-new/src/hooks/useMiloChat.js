import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { streamMessage } from '../utils/chat'

const BACKEND = 'http://localhost:8000'
const MAX_LENGTH = 2000

async function persistSession(sessionId, messages) {
  // Skip the greeting (index 0) — it's synthetic per-theme text
  const toSave = messages.slice(1).map(({ role, text }) => ({ role, text }))
  if (toSave.length === 0) return

  // Persist response times and model names locally (backend only stores role+text)
  const timings = messages.slice(1).map(m => m.metrics?.response_ms ?? null)
  const modelNames = messages.slice(1).map(m => m.metrics?.model ?? null)
  localStorage.setItem(`milo_timings_${sessionId}`, JSON.stringify(timings))
  localStorage.setItem(`milo_models_${sessionId}`, JSON.stringify(modelNames))

  try {
    await fetch(`${BACKEND}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, messages: toSave }),
    })
  } catch {}
}

export function useMiloChat(greeting, useLibrary = true) {
  const { state } = useLocation()
  const [sessionId, setSessionId] = useState(() => state?.pendingSession?.id ?? null)
  const [messages, setMessages] = useState(() => {
    const pending = state?.pendingSession
    if (!pending) return [{ role: 'bot', text: greeting }]
    const timings = JSON.parse(localStorage.getItem(`milo_timings_${pending.id}`) || '[]')
    const modelNames = JSON.parse(localStorage.getItem(`milo_models_${pending.id}`) || '[]')
    const withTimings = pending.messages.map((m, i) => {
      const ms = timings[i]
      const model = modelNames[i]
      if (ms != null || model != null) return { ...m, metrics: { ...(ms != null ? { response_ms: ms } : {}), ...(model != null ? { model } : {}) } }
      return m
    })
    return [{ role: 'bot', text: greeting }, ...withTimings]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [sessionStats, setSessionStats] = useState({ messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 })

  const messagesRef = useRef(messages)
  const estimateTimerRef = useRef(null)

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Keep model warm — ping every 4 minutes so the first response after idle stays fast
  useEffect(() => {
    const ping = () => fetch(`${BACKEND}/warmup`, { method: 'POST' }).catch(() => {})
    ping()
    const id = setInterval(ping, 4 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Debounced pre-send token estimate
  useEffect(() => {
    if (!input.trim()) {
      setEstimate(null)
      return
    }
    clearTimeout(estimateTimerRef.current)
    estimateTimerRef.current = setTimeout(async () => {
      const currentMessages = messagesRef.current
      const history = currentMessages
        .slice(-6)
        .filter(m => m.role === 'user' || m.role === 'bot')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }))
      try {
        const res = await fetch(`${BACKEND}/chat/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.trim(), history }),
        })
        if (!res.ok) return
        const data = await res.json()
        setEstimate({ inputTokens: data.input_tokens, estimatedCost: data.estimated_cost })
      } catch {}
    }, 400)
    return () => clearTimeout(estimateTimerRef.current)
  }, [input])

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
    setStatus(null)
    setEstimate(null)

    let accumulated = ''

    await streamMessage(text, useLibrary, history, {
      onStatus: (msg) => setStatus(msg),
      onToken: (token) => {
        accumulated += token
        setStatus(null)
        setMessages([...withUser, { role: 'bot', text: accumulated, streaming: true }])
      },
      onDone: (metrics) => {
        const final = [...withUser, { role: 'bot', text: accumulated || '(no response)', metrics }]
        setMessages(final)
        setLoading(false)
        setStatus(null)
        persistSession(sid, final)
        if (metrics) {
          setSessionStats(prev => ({
            messageCount: prev.messageCount + 1,
            totalInputTokens: prev.totalInputTokens + (metrics.input_tokens ?? 0),
            totalOutputTokens: prev.totalOutputTokens + (metrics.output_tokens ?? 0),
            totalCost: prev.totalCost + (metrics.cost ?? 0),
          }))
        }
      },
      onError: (msg) => {
        const final = [...withUser, { role: 'bot', text: msg, metrics: null }]
        setMessages(final)
        setLoading(false)
        setStatus(null)
      },
    })
  }

  function resetChat() {
    setSessionId(null)
    setMessages([{ role: 'bot', text: greeting }])
    setSessionStats({ messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 })
  }

  function loadSession(id, savedMessages) {
    const timings = JSON.parse(localStorage.getItem(`milo_timings_${id}`) || '[]')
    const modelNames = JSON.parse(localStorage.getItem(`milo_models_${id}`) || '[]')
    const withTimings = savedMessages.map((m, i) => {
      const ms = timings[i]
      const model = modelNames[i]
      if (ms != null || model != null) return { ...m, metrics: { ...(ms != null ? { response_ms: ms } : {}), ...(model != null ? { model } : {}) } }
      return m
    })
    setSessionId(id)
    setMessages([{ role: 'bot', text: greeting }, ...withTimings])
    setSessionStats({ messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0 })
  }

  return { messages, input, setInput, loading, status, send, resetChat, sessionId, loadSession, estimate, sessionStats }
}
