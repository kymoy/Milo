import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import MiloMarkdown from '../../components/MiloMarkdown'
import LoadingDots from '../../components/LoadingDots'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `${user?.username} — I'm Milo. Ask me anything.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX) return
    const withUser = [...messages, { role: 'user', text }]
    setMessages(withUser); setInput(''); setLoading(true); setStatus(null)
    let accumulated = ''
    try {
      const res = await fetch(`${BACKEND}/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'status') { setStatus(event.message) }
            else if (event.type === 'token') { accumulated += event.content; setStatus(null); setMessages([...withUser, { role: 'bot', text: accumulated }]) }
            else if (event.type === 'done') { setMessages([...withUser, { role: 'bot', text: accumulated }]) }
            else if (event.type === 'error') { setMessages([...withUser, { role: 'bot', text: event.message }]) }
          } catch {}
        }
      }
    } catch { setMessages([...withUser, { role: 'bot', text: 'No connection.' }]) }
    finally { setLoading(false); setStatus(null) }
  }

  return (
    <div style={{ background: 'radial-gradient(ellipse at 80% 0%, #1a0800 0%, #050508 50%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '860px', margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 32px', borderBottom: '1px solid #0f0e0d' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#f0ece4', letterSpacing: '2px', fontFamily: "'Impact','Arial Black',sans-serif", textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/combined/admin')} style={{ background: 'none', border: 'none', color: '#ff7c45', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Admin</button>}
          <span style={{ color: '#8a6a3a', fontSize: '11px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/combined/login') }} style={{ background: 'none', border: 'none', color: '#8a6a3a', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Exit</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '66%' }}>
              {m.role === 'bot' && <div style={{ fontSize: '8px', letterSpacing: '2px', color: '#aa7040', textTransform: 'uppercase', marginBottom: '6px' }}>MILO</div>}
              <div style={{ fontSize: '14px', lineHeight: 1.65, color: m.role === 'user' ? '#fff' : '#c0a888', background: m.role === 'user' ? 'linear-gradient(135deg,#ff7c45,#cc3300)' : 'transparent', border: m.role === 'bot' ? '1px solid #1a0e08' : 'none', padding: '12px 16px', letterSpacing: '0.2px' }}>
                {m.role === 'user' ? m.text : <MiloMarkdown>{m.text}</MiloMarkdown>}
              </div>
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && <LoadingDots text={status || 'Processing...'} style={{ fontSize: '9px', color: '#aa7040', letterSpacing: '3px', textTransform: 'uppercase' }} />}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #0f0e0d' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: '#f0ece4', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? 'transparent' : 'linear-gradient(135deg,#ff7c45,#cc3300)', border: 'none', borderLeft: '1px solid #0f0e0d', padding: '20px 28px', color: loading || !input.trim() ? '#2a1a0a' : '#fff', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}

