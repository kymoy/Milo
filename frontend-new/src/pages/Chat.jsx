import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX_LENGTH = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { role: 'bot', text: `Hey ${user?.username}, I'm Milo. How can I help you?` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    if (text.length > MAX_LENGTH) return

    // Capture history before state update; skip the initial greeting (index 0)
    const history = messages.slice(1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      text: msg.text,
    }))

    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Could not reach the backend.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex justify-center">
      <div className="flex flex-col w-full max-w-3xl h-screen bg-[#16161e]">

        <header className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
          <span className="text-[#a78bfa] font-bold tracking-widest text-lg">MILO</span>
          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className="text-[#6b6b8a] hover:text-[#a78bfa] text-sm transition-colors">
                Admin
              </button>
            )}
            <span className="text-[#6b6b8a] text-sm">{user?.username}</span>
            <button onClick={handleLogout} className="text-[#6b6b8a] hover:text-red-400 text-sm transition-colors">
              Sign out
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#7c3aed] text-white rounded-br-sm'
                  : 'bg-[#1e1e2e] border border-[#2a2a3a] text-[#e8e8f0] rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#1e1e2e] border border-[#2a2a3a] text-[#6b6b8a] px-4 py-3 rounded-2xl rounded-bl-sm text-sm">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-6 py-4 border-t border-[#2a2a3a] flex gap-3">
          <input
            type="text"
            value={input}
            maxLength={MAX_LENGTH}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-[#1e1e2e] border border-[#2a2a3a] rounded-xl px-4 py-3 text-[#e8e8f0] text-sm outline-none focus:border-[#7c3aed]"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#3b3b52] text-white font-semibold rounded-xl px-5 text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
