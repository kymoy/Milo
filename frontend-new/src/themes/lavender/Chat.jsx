import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hi ${user?.username} — I'm Milo. How can I help you today?` }])
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
    <div style={{ background: 'linear-gradient(135deg, #1a1228 0%, #0f0a1e 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid rgba(196,181,253,0.1)' }}>
        <span style={{ fontSize: '13px', fontWeight: 300, color: '#c4b5fd', letterSpacing: '5px', textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/lavender/admin')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Admin</button>}
          <span style={{ color: '#9a88be', fontSize: '12px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/lavender/login') }} style={{ background: 'none', border: 'none', color: '#8a78b8', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '68%', fontSize: '14px', lineHeight: 1.6, color: m.role === 'user' ? '#fff' : '#c4b5fd', background: m.role === 'user' ? 'linear-gradient(135deg,#c4b5fd,#7c3aed)' : 'rgba(196,181,253,0.06)', border: m.role === 'bot' ? '1px solid rgba(196,181,253,0.12)' : 'none', padding: '12px 16px', borderRadius: '12px' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '12px', color: '#9a88be' }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '20px 28px', borderTop: '1px solid rgba(196,181,253,0.1)' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'rgba(196,181,253,0.06)', border: '1px solid rgba(196,181,253,0.15)', borderRadius: '10px', padding: '12px 16px', color: '#ede9fe', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? 'rgba(196,181,253,0.06)' : 'linear-gradient(135deg,#c4b5fd,#7c3aed)', border: '1px solid rgba(196,181,253,0.15)', borderRadius: '10px', padding: '12px 22px', color: loading || !input.trim() ? '#3d2a6a' : '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}
