import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { sendMessage } from '../../utils/chat'

const MAX = 2000
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 100, letterSpacing: '6px', textTransform: 'uppercase' }

const DARK  = { bg: '#000', sidebar: '#080808', border: '#1e1e1e', text: '#fff', muted: '#aaa', accent: '#fff', input: 'transparent', userBubble: '#fff', botBubble: 'transparent', botText: '#aaa' }
const LIGHT = { bg: '#fff', sidebar: '#f5f5f5', border: '#ddd',    text: '#000', muted: '#666', accent: '#000', input: 'transparent', userBubble: '#000', botBubble: 'transparent', botText: '#666' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const [messages, setMessages] = useState([{ role: 'bot', text: `${user?.username} — ready.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/crystals/login') }

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
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => setMessages([{ role: 'bot', text: `${user?.username} — ready.` }])} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '2px', padding: '6px 14px', color: c.muted, fontSize: '10px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '65%', fontSize: '14px', lineHeight: 1.7, fontFamily: 'system-ui', color: m.role === 'user' ? c.bg : c.botText, background: m.role === 'user' ? c.accent : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '14px 18px', borderRadius: '2px' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, letterSpacing: '3px' }}>Processing...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', borderTop: `1px solid ${c.border}` }}>
          <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." autoComplete="off"
            style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: c.text, fontSize: '14px', outline: 'none', fontFamily: 'system-ui' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ ...MONO_U, background: 'none', border: 'none', borderLeft: `1px solid ${c.border}`, padding: '20px 28px', color: loading || !input.trim() ? c.muted : c.text, fontSize: '10px', letterSpacing: '3px', cursor: 'pointer' }}>
            Send
          </button>
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}
