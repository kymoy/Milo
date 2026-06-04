import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `${user?.username} — ready.` }])
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
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid #111' }}>
        <span style={{ fontSize: '11px', letterSpacing: '4px', color: '#fff' }}>MILO</span>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/crystals/admin')} style={{ background: 'none', border: 'none', color: '#444', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit' }}>ADMIN</button>}
          <button onClick={() => { logout(); navigate('/crystals/login') }} style={{ background: 'none', border: 'none', color: '#777', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit' }}>EXIT</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '65%', fontSize: '13px', lineHeight: 1.7, letterSpacing: '0.3px', color: m.role === 'user' ? '#000' : '#fff', background: m.role === 'user' ? '#fff' : 'transparent', border: m.role === 'bot' ? '1px solid #111' : 'none', padding: '14px 18px', borderRadius: '2px' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '11px', color: '#777', letterSpacing: '2px' }}>PROCESSING...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '0', borderTop: '1px solid #111' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: '#fff', fontSize: '13px', letterSpacing: '0.5px', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'none', border: 'none', borderLeft: '1px solid #111', padding: '20px 32px', color: loading || !input.trim() ? '#222' : '#fff', fontSize: '10px', letterSpacing: '3px', cursor: 'pointer', fontFamily: 'inherit' }}>SEND</button>
      </div>
    </div>
  )
}
