import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { sendMessage } from '../../utils/chat'

const MAX = 2000
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)', sidebar: '#0a0604', border: 'rgba(255,107,43,0.2)', text: '#fff', muted: '#bbb', accent: '#ff6b2b', input: 'rgba(255,255,255,0.05)', userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.05)', botText: '#fff' }
const LIGHT = { bg: 'radial-gradient(ellipse at 70% 10%, #ff9966 0%, #fff8f4 70%)',   sidebar: '#ffe8d8', border: 'rgba(204,51,0,0.25)',   text: '#1a0800', muted: '#885533', accent: '#cc3300', input: 'rgba(255,255,255,0.6)',  userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.55)', botText: '#1a0800' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const [messages, setMessages] = useState([{ role: 'bot', text: `Hey ${user?.username}, I'm Milo. Ask me anything.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/stokt/login') }

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
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => setMessages([{ role: 'bot', text: `Hey ${user?.username}, I'm Milo. Ask me anything.` }])} />

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
              <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.6, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.userBubble : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '10px' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
          <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." autoComplete="off"
            style={{ flex: 1, background: c.input, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '13px 16px', color: c.text, fontSize: '15px', outline: 'none', fontFamily: 'system-ui' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? c.botBubble : c.userBubble, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '12px 24px', color: loading || !input.trim() ? c.muted : '#fff', fontSize: '16px', ...SERIF, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}
