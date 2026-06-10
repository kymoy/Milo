import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import MiloMarkdown from '../../components/MiloMarkdown'

const BACKEND = 'http://localhost:8000'
const MAX = 2000
const T = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

function getTheme() {
  try { return JSON.parse(localStorage.getItem('milo_custom_theme')) } catch { return null }
}

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const c = getTheme() || { bg: '#0f0f13', accent: '#7c3aed', text: '#e8e8f0', userBubble: '#7c3aed', botBubble: '#1e1e2e', botText: '#e8e8f0' }
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hi ${user?.username} — I'm Milo. How can I help you?` }])
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

  const border = `1px solid ${c.accent}22`

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: border }}>
        <span style={{ ...T, fontSize: '13px', fontWeight: 100, letterSpacing: '6px', color: c.accent }}>MILO</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/custom/admin')} style={{ ...T, background: 'none', border: 'none', color: c.accent, fontSize: '8px', letterSpacing: '3px', cursor: 'pointer', fontWeight: 300 }}>Admin</button>
          )}
          <button onClick={() => navigate('/')} style={{ ...T, background: 'none', border: 'none', color: `${c.text}55`, fontSize: '8px', letterSpacing: '3px', cursor: 'pointer', fontWeight: 300 }}>Themes</button>
          <span style={{ ...T, fontSize: '8px', letterSpacing: '2px', color: `${c.text}44`, fontWeight: 300 }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/custom/login') }} style={{ ...T, background: 'none', border: 'none', color: `${c.text}44`, fontSize: '8px', letterSpacing: '3px', cursor: 'pointer', fontWeight: 300 }}>Exit</button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '68%', fontSize: '14px', lineHeight: 1.6, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.userBubble : c.botBubble, border: m.role === 'bot' ? border : 'none', padding: '12px 16px', borderRadius: '10px' }}>
              {m.role === 'user' ? m.text : <MiloMarkdown>{m.text}</MiloMarkdown>}
            </div>
          </div>
        ))}
        {loading && <div style={{ ...T, fontSize: '8px', letterSpacing: '3px', color: `${c.text}44`, fontWeight: 300 }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px', padding: '18px 28px', borderTop: border }}>
        <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..."
          style={{ flex: 1, background: `${c.accent}0d`, border: `1px solid ${c.accent}22`, borderRadius: '8px', padding: '12px 16px', color: c.text, fontSize: '14px', outline: 'none', fontFamily: 'system-ui' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{ ...T, background: loading || !input.trim() ? `${c.accent}22` : c.accent, border: 'none', borderRadius: '8px', padding: '12px 22px', color: loading || !input.trim() ? `${c.text}44` : '#fff', fontSize: '8px', letterSpacing: '3px', fontWeight: 300, cursor: 'pointer' }}>
          Send
        </button>
      </div>
    </div>
  )
}

