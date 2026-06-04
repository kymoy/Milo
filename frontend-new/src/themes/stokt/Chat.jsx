import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hey ${user?.username}, I'm Milo. Ask me anything.` }])
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
    <div style={{ background: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px', borderBottom: '1px solid rgba(255,107,43,0.15)' }}>
        <span style={{ fontSize: '11px', letterSpacing: '4px', color: '#ff6b2b', textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/stokt/admin')} style={{ background: 'none', border: 'none', color: '#ff6b2b', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Admin</button>}
          <span style={{ color: '#999', fontSize: '12px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/stokt/login') }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '68%', fontSize: '14px', lineHeight: 1.6, color: '#fff', background: m.role === 'user' ? 'linear-gradient(135deg,#ff6b2b,#cc3300)' : 'rgba(255,255,255,0.05)', border: m.role === 'bot' ? '1px solid rgba(255,107,43,0.15)' : 'none', padding: '12px 16px', borderRadius: '10px' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '12px', color: '#ff6b2b' }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '20px 28px', borderTop: '1px solid rgba(255,107,43,0.15)' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,107,43,0.2)', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#ff6b2b,#cc3300)', border: 'none', borderRadius: '8px', padding: '12px 22px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}
