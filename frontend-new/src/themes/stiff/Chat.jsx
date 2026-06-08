import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { sendMessage } from '../../utils/chat'

const MAX = 2000
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }

const DARK  = { bg: '#12121e', sidebar: '#0d0d18', border: '#2a2a40', text: '#f5f0e8', muted: '#999', accent: '#cc2200', input: '#1c1c2e', userBubble: '#cc2200', botBubble: '#1c1c2e', botText: '#c8c0b0' }
const LIGHT = { bg: '#f5f0e8', sidebar: '#ece8e0', border: '#c8c0b8', text: '#12121e', muted: '#777', accent: '#cc2200', input: '#ece8e0', userBubble: '#cc2200', botBubble: '#e8e0d8', botText: '#12121e' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [showSettings, setShowSettings] = useState(false)
  const c = mode === 'dark' ? DARK : LIGHT
  const [messages, setMessages] = useState([{ role: 'bot', text: `What's good, ${user?.username}? I'm Milo.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/stiff/login') }

  async function send() {
    const text = input.trim()
    if (!text || loading || text.length > MAX) return
    setMessages(p => [...p, { role: 'user', text }]); setInput(''); setLoading(true)
    const reply = await sendMessage(text)
    setMessages(p => [...p, { role: 'bot', text: reply }])
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => setMessages([{ role: 'bot', text: `What's good, ${user?.username}? I'm Milo.` }])} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderBottom: `2px solid ${c.border}` }}>
          <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
            style={{ ...MONO_U, background: 'none', border: `2px solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.6, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.accent : c.botBubble, border: m.role === 'bot' ? `2px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '4px' }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.accent }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderTop: `2px solid ${c.border}` }}>
          <input value={input} maxLength={MAX} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Say something..."
            style={{ flex: 1, background: c.input, border: `2px solid ${c.border}`, borderRadius: '4px', padding: '13px 16px', color: c.text, fontSize: '15px', outline: 'none', fontFamily: 'system-ui' }} />
          <button onClick={send} disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? c.input : c.accent, border: `2px solid ${loading || !input.trim() ? c.border : c.accent}`, borderRadius: '4px', padding: '12px 24px', color: loading || !input.trim() ? c.muted : '#fff', fontSize: '15px', ...SERIF, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} />}
    </div>
  )
}
