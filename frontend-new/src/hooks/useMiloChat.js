import { useState } from 'react'
import { sendMessage } from '../utils/chat'

const MAX_LENGTH = 2000

export function useMiloChat(greeting, useLibrary = true) {
  const [messages, setMessages] = useState([{ role: 'bot', text: greeting }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX_LENGTH) return
    const history = messages.slice(1).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      text: m.text,
    }))
    setMessages(p => [...p, { role: 'user', text }])
    setInput('')
    setLoading(true)
    const { reply, metrics } = await sendMessage(text, useLibrary, history)
    setMessages(p => [...p, { role: 'bot', text: reply, metrics }])
    setLoading(false)
  }

  function resetChat() {
    setMessages([{ role: 'bot', text: greeting }])
  }

  return { messages, input, setInput, loading, send, resetChat }
}
