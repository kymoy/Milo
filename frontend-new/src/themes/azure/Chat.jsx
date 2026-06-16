import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import { useMiloChat } from '../../hooks/useMiloChat'
import MiloMarkdown from '../../components/MiloMarkdown'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'linear-gradient(135deg, #0d1b35 0%, #162040 100%)', sidebar: '#0f1e38', border: 'rgba(96,165,250,0.25)', text: '#e8f0ff', muted: '#90b8f0', accent: '#60a5fa', input: 'rgba(96,165,250,0.08)', userBubble: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', botBubble: 'rgba(59,130,246,0.14)', botText: '#bcd9ff' }
const LIGHT = { bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', sidebar: '#dbeafe',   border: 'rgba(59,130,246,0.25)', text: '#1e3a5f', muted: '#3b6cb0', accent: '#1d4ed8', input: 'rgba(59,130,246,0.05)', userBubble: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', botBubble: 'rgba(59,130,246,0.07)', botText: '#1e3a5f' }

const GLOWS = [
  { top: '5%',  left: '35%', size: '520px', color: 'rgba(59,130,246,0.11)',  blur: '110px' },
  { bottom: '12%', right: '18%', size: '400px', color: 'rgba(99,102,241,0.09)', blur: '85px'  },
  { top: '58%', left: '6%',  size: '300px', color: 'rgba(147,197,253,0.08)', blur: '65px'  },
]

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT

  const greeting = `Hi ${user?.username} — I'm Milo. How can I help you today?`
  const { messages, input, setInput, loading, send, resetChat, sessionId, loadSession } = useMiloChat(greeting, useLibrary)

  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate('/azure/login') }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg, position: 'relative', overflow: 'hidden' }}>

      {mode === 'dark' && GLOWS.map((g, i) => (
        <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: g.color, filter: `blur(${g.blur})`, pointerEvents: 'none', width: g.size, height: g.size, top: g.top, bottom: g.bottom, left: g.left, right: g.right }} />
      ))}

      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={resetChat} onLoadSession={loadSession} activeSessionId={sessionId} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <button onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {messages.map((m, i) => {
            const prevBot = messages.slice(0, i).reverse().find(msg => msg.role === 'bot' && msg.metrics?.model)
            const modelChanged = m.role === 'bot' && m.metrics?.model && prevBot?.metrics?.model && m.metrics.model !== prevBot.metrics.model
            return (
              <div key={i}>
                {modelChanged && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px', opacity: 0.55 }}>
                    <div style={{ flex: 1, height: '1px', background: c.border }} />
                    <span style={{ fontSize: '10px', color: c.muted, fontFamily: 'monospace', letterSpacing: '0.5px' }}>↺ {m.metrics.model}</span>
                    <div style={{ flex: 1, height: '1px', background: c.border }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '68%', fontSize: '15px', lineHeight: 1.65, fontFamily: 'system-ui', color: m.role === 'user' ? '#fff' : c.botText, background: m.role === 'user' ? c.userBubble : c.botBubble, border: m.role === 'bot' ? `1px solid ${c.border}` : 'none', padding: '12px 16px', borderRadius: '12px' }}>
                    {m.role === 'user' ? m.text : <MiloMarkdown>{m.text}</MiloMarkdown>}
                  </div>
                  {m.role === 'bot' && m.metrics && (
                    <div style={{ fontSize: '11px', color: c.muted, marginTop: '4px', fontFamily: 'monospace' }}>
                      {[m.metrics.model, m.metrics.response_ms != null && `${(m.metrics.response_ms / 1000).toFixed(1)}s`, m.metrics.cpu_percent != null && `CPU ${m.metrics.cpu_percent}%`, m.metrics.tokens_per_sec != null && `${m.metrics.tokens_per_sec} tok/s`, m.metrics.gpu_percent != null && `GPU ${m.metrics.gpu_percent}%`].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {loading && <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Thinking...</div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px', borderTop: `1px solid ${c.border}` }}>
          <input value={input} maxLength={2000} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." autoComplete="off"
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

