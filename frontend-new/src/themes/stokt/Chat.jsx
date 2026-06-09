import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { useMiloChat } from '../../hooks/useMiloChat'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)', sidebar: '#0a0604', border: 'rgba(255,107,43,0.2)', text: '#fff', muted: '#bbb', accent: '#ff6b2b', input: 'rgba(255,255,255,0.05)', userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.05)', botText: '#fff' }
const LIGHT = { bg: 'radial-gradient(ellipse at 70% 10%, #ff9966 0%, #fff8f4 70%)',   sidebar: '#ffe8d8', border: 'rgba(204,51,0,0.25)',   text: '#1a0800', muted: '#885533', accent: '#cc3300', input: 'rgba(255,255,255,0.6)',  userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.55)', botText: '#1a0800' }

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT

  const greeting = `Hey ${user?.username}, I'm Milo. Ask me anything.`
  const { messages, input, setInput, loading, send, resetChat } = useMiloChat(greeting, useLibrary)

  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/stokt/login') }

  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={resetChat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <button onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.6, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.userBubble : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '10px' }}>
                {m.text}
              </div>
              {m.role === 'bot' && m.metrics && (
                <div style={{ fontSize: '11px', color: c.muted, marginTop: '4px', fontFamily: 'monospace' }}>
                  {[`${(m.metrics.response_ms / 1000).toFixed(1)}s`, m.metrics.cpu_percent != null && `CPU ${m.metrics.cpu_percent}%`, m.metrics.tokens_per_sec != null && `${m.metrics.tokens_per_sec} tok/s`, m.metrics.gpu_percent != null && `GPU ${m.metrics.gpu_percent}%`].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
          <input value={input} maxLength={2000} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." autoComplete="off"
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

