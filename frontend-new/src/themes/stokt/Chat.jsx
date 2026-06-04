import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const MAX = 2000
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)', text: '#fff', muted: '#bbb', border: 'rgba(255,107,43,0.2)', inputBg: 'rgba(255,255,255,0.05)', botBubble: 'rgba(255,255,255,0.05)', botText: '#fff', accent: '#ff6b2b', btnGrad: 'linear-gradient(135deg,#ff6b2b,#cc3300)' }
const LIGHT = { bg: 'radial-gradient(ellipse at 70% 10%, #ff9966 0%, #fff8f4 70%)', text: '#1a0800', muted: '#885533', border: 'rgba(204,51,0,0.25)', inputBg: 'rgba(255,255,255,0.6)', botBubble: 'rgba(255,255,255,0.55)', botText: '#1a0800', accent: '#cc3300', btnGrad: 'linear-gradient(135deg,#ff6b2b,#cc3300)' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const c = mode === 'dark' ? DARK : LIGHT
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
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px', borderBottom: `1px solid ${c.border}` }}>
        <span style={{ ...MONO_U, fontSize: '14px', color: c.accent }}>MILO</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/stokt/admin')} style={{ ...SERIF, background: 'none', border: 'none', color: c.accent, fontSize: '16px', cursor: 'pointer', fontStyle: 'italic' }}>Admin</button>
          )}
          <span style={{ ...SERIF, color: c.muted, fontSize: '16px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/stokt/login') }} style={{ ...SERIF, background: 'none', border: 'none', color: c.muted, fontSize: '16px', cursor: 'pointer', fontStyle: 'italic' }}>Sign out</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.6, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.btnGrad : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '10px' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '20px 28px', borderTop: `1px solid ${c.border}` }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..."
          style={{ flex: 1, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '13px 16px', color: c.text, fontSize: '15px', outline: 'none', fontFamily: 'system-ui' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ background: loading || !input.trim() ? c.botBubble : c.btnGrad, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '12px 24px', color: loading || !input.trim() ? c.muted : '#fff', fontSize: '16px', ...SERIF, cursor: 'pointer' }}>
          Send
        </button>
      </div>
    </div>
  )
}
