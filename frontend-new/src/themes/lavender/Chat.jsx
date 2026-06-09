import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { sendMessage } from '../../utils/chat'

const MAX = 2000
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'linear-gradient(135deg, #1a1228 0%, #0f0a1e 100%)', sidebar: '#110c1c', border: 'rgba(196,181,253,0.15)', text: '#ede9fe', muted: '#b8a8e0', accent: '#c4b5fd', input: 'rgba(196,181,253,0.06)', userBubble: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', botBubble: 'rgba(196,181,253,0.07)', botText: '#c4b5fd' }
const LIGHT = { bg: 'linear-gradient(135deg, #f0ecff 0%, #e8e0ff 100%)', sidebar: '#e0d8f8', border: 'rgba(124,58,237,0.2)',  text: '#1a0a40', muted: '#7755bb', accent: '#6d28d9', input: 'rgba(124,58,237,0.05)', userBubble: 'linear-gradient(135deg,#a78bfa,#6d28d9)', botBubble: 'rgba(124,58,237,0.06)', botText: '#1a0a40' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hi ${user?.username} — I'm Milo. How can I help you today?` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/lavender/login') }

  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX) return
    const history = messages.slice(1).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }))
    setMessages(p => [...p, { role: 'user', text }]); setInput(''); setLoading(true)
    const reply = await sendMessage(text, useLibrary, history)
    setMessages(p => [...p, { role: 'bot', text: reply }])
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => setMessages([{ role: 'bot', text: `Hi ${user?.username} — I'm Milo. How can I help?` }])} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.65, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.userBubble : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '12px' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
          <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." autoComplete="off"
            style={{ flex: 1, background: c.input, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '13px 16px', color: c.text, fontSize: '15px', outline: 'none', fontFamily: 'system-ui' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? c.input : c.accent, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '12px 22px', color: loading || !input.trim() ? c.muted : '#fff', fontSize: '16px', ...SERIF, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}
