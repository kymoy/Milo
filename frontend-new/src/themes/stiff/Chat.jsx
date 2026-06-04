import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([{ role: 'bot', text: `What's good, ${user?.username}? I'm Milo.` }])
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
    <div style={{ background: '#12121e', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '2px solid #1c1c2e' }}>
        <span style={{ fontSize: '22px', fontWeight: 900, color: '#f5f0e8', letterSpacing: '-1px', fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {user?.role === 'admin' && <button onClick={() => navigate('/stiff/admin')} style={{ background: 'none', border: 'none', color: '#cc2200', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, textTransform: 'uppercase' }}>Admin</button>}
          <span style={{ color: '#999', fontSize: '12px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/stiff/login') }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '68%', fontSize: '14px', lineHeight: 1.6, color: m.role === 'user' ? '#f5f0e8' : '#c8c0b0', background: m.role === 'user' ? '#cc2200' : '#1c1c2e', border: m.role === 'bot' ? '2px solid #2a2a40' : 'none', padding: '12px 16px', borderRadius: '4px' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: '12px', color: '#cc2200', letterSpacing: '1px' }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '12px', padding: '20px 28px', borderTop: '2px solid #1c1c2e' }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Say something..." style={{ flex: 1, background: '#1c1c2e', border: '2px solid #2a2a40', borderRadius: '4px', padding: '12px 16px', color: '#f5f0e8', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading || !input.trim() ? '#2a2a40' : '#cc2200', border: 'none', borderRadius: '4px', padding: '12px 24px', color: '#f5f0e8', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
      </div>
    </div>
  )
}
