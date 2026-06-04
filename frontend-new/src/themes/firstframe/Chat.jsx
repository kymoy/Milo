import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `${user?.username} — session active.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX) return
    setMessages(p => [...p, { role: 'user', text }]); setInput(''); setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) })
      const data = await res.json()
      setMessages(p => [...p, { role: 'bot', text: data.reply }])
    } catch { setMessages(p => [...p, { role: 'bot', text: 'No connection.' }]) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '860px', margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid #0d1520' }}>
        <span style={{ fontSize: '10px', letterSpacing: '3px', color: '#c8d8e8', textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/firstframe/admin')} style={{ background: 'none', border: 'none', color: '#6a9abb', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Admin</button>}
          <span style={{ color: '#5a7a9a', fontSize: '10px', letterSpacing: '1px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/firstframe/login') }} style={{ background: 'none', border: 'none', color: '#5a7a9a', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Exit</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '65%' }}>
              {m.role === 'bot' && <div style={{ fontSize: '8px', letterSpacing: '2px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '6px' }}>MILO</div>}
              <div style={{ fontSize: '13px', lineHeight: 1.7, color: m.role === 'user' ? '#c8d8e8' : '#7a9ab5', letterSpacing: '0.2px' }}>{m.text}</div>
              {m.role === 'user' && <div style={{ fontSize: '8px', color: '#5a7a9a', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '6px', textAlign: 'right' }}>{user?.username}</div>}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '9px', color: '#6a9abb', letterSpacing: '3px', textTransform: 'uppercase' }}>Processing...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #0d1520' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: '#c8d8e8', fontSize: '13px', outline: 'none', fontFamily: 'inherit', letterSpacing: '0.2px' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'none', border: 'none', borderLeft: '1px solid #0d1520', padding: '20px 28px', color: loading || !input.trim() ? '#1a2a3a' : '#c8d8e8', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}
