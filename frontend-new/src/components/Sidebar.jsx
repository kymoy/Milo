import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

export default function Sidebar({ colors: c, user, onLogout, onSettings, onNewChat, onLoadSession, activeSessionId }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const themePrefix = pathname.split('/')[1]
  const isOnAdmin = pathname.endsWith('/admin')
  const adminTogglePath  = isOnAdmin ? `/${themePrefix}/chat` : `/${themePrefix}/admin`
  const adminToggleLabel = isOnAdmin ? '← Back to chat' : '⚙ Admin panel'

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('milo_sidebar') === 'collapsed')
  const [sessions, setSessions] = useState([])
  const [deletingId, setDeletingId] = useState(null)

  function toggle() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem('milo_sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/chats`)
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchSessions()
    const id = setInterval(fetchSessions, 10000)
    return () => clearInterval(id)
  }, [fetchSessions])

  useEffect(() => { fetchSessions() }, [activeSessionId, fetchSessions])

  async function handleDelete(e, sessionId) {
    e.stopPropagation()
    setDeletingId(sessionId)
    try {
      await fetch(`${BACKEND}/chats/${sessionId}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch {}
    setDeletingId(null)
  }

  async function handleLoad(session) {
    try {
      const res = await fetch(`${BACKEND}/chats/${session.id}`)
      const data = await res.json()
      const messages = data.messages ?? []
      if (isOnAdmin) {
        navigate(`/${themePrefix}/chat`, { state: { pendingSession: { id: session.id, messages } } })
        return
      }
      onLoadSession?.(session.id, messages)
    } catch {}
  }

  if (collapsed) {
    return (
      <div
        onClick={toggle}
        title="Expand sidebar"
        style={{
          width: '56px', minWidth: '56px', background: c.sidebar,
          borderRight: `1px solid ${c.border}`, display: 'flex',
          flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
          alignItems: 'center', paddingTop: '16px', paddingBottom: '16px', gap: '10px',
          cursor: 'pointer',
        }}>
        <div style={{ fontSize: '16px', color: c.muted, lineHeight: 1, padding: '4px 6px' }}>›</div>
        <button
          onClick={e => { e.stopPropagation(); onNewChat() }}
          title="New Chat"
          style={{ background: `${c.accent}18`, border: `1px solid ${c.accent}44`, borderRadius: '8px', width: '36px', height: '36px', color: c.accent, cursor: 'pointer', fontSize: '20px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = `${c.accent}28`}
          onMouseLeave={e => e.currentTarget.style.background = `${c.accent}18`}>
          +
        </button>
        <div style={{ flex: 1 }} />
        <div
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${c.accent}33`, border: `1px solid ${c.accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title={user?.username}
          onClick={e => { e.stopPropagation(); onSettings() }}>
          <span style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>{user?.username?.[0]?.toUpperCase()}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '240px', minWidth: '240px', background: c.sidebar,
      borderRight: `1px solid ${c.border}`, display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      position: 'relative',
    }}>
      {/* Full-height right-edge collapse strip — widens on hover for easy clicking */}
      <div
        onClick={toggle}
        title="Collapse sidebar"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px',
          cursor: 'col-resize', zIndex: 10, transition: 'width 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.width = '20px'; e.currentTarget.style.background = `${c.accent}28` }}
        onMouseLeave={e => { e.currentTarget.style.width = '8px'; e.currentTarget.style.background = 'transparent' }}
      />
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ marginBottom: '14px' }}>
          <div onClick={() => navigate('/')} style={{ ...MONO_U, fontSize: '14px', color: c.accent, cursor: 'pointer', display: 'inline-block' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>MILO</div>
        </div>
        <button onClick={onNewChat} style={{
          width: '100%', background: `${c.accent}18`, border: `1px solid ${c.accent}44`,
          borderRadius: '8px', padding: '9px 14px', color: c.accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 300, fontSize: '15px', transition: 'background 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = `${c.accent}28`}
          onMouseLeave={e => e.currentTarget.style.background = `${c.accent}18`}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span> New Chat
        </button>
      </div>

      {/* Chat history */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        <div style={{ ...SERIF, fontSize: '11px', color: c.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '8px' }}>
          {sessions.length > 0 ? `${sessions.length} chat${sessions.length !== 1 ? 's' : ''}` : 'No chats yet'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sessions.map(s => {
            const isActive = s.id === activeSessionId
            return (
              <div key={s.id} onClick={() => handleLoad(s)} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: isActive ? `${c.accent}18` : 'transparent',
                borderRadius: '7px', padding: '8px 10px',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = `${c.accent}0d` }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{
                  flex: 1, minWidth: 0,
                  ...SERIF, fontSize: '14px',
                  color: isActive ? c.text : c.muted,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {s.title}
                </div>
                <button
                  onClick={e => handleDelete(e, s.id)}
                  disabled={deletingId === s.id}
                  style={{
                    background: 'none', border: 'none', color: c.muted,
                    cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                    padding: '0 2px', opacity: 0, flexShrink: 0,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = c.muted }}
                  ref={el => {
                    if (el) {
                      el.parentElement.addEventListener('mouseenter', () => { el.style.opacity = '0.5' })
                      el.parentElement.addEventListener('mouseleave', () => { el.style.opacity = '0' })
                    }
                  }}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Admin link */}
      {user?.role === 'admin' && (
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${c.border}` }}>
          <button onClick={async () => {
            if (isOnAdmin) {
              const lastId = localStorage.getItem('milo_last_session_id')
              if (lastId) {
                try {
                  const res = await fetch(`${BACKEND}/chats/${lastId}`)
                  const data = await res.json()
                  navigate(`/${themePrefix}/chat`, { state: { pendingSession: { id: lastId, messages: data.messages ?? [] } } })
                  return
                } catch {}
              }
              navigate(`/${themePrefix}/chat`)
            } else {
              if (activeSessionId) localStorage.setItem('milo_last_session_id', activeSessionId)
              navigate(adminTogglePath)
            }
          }} style={{
            width: '100%', background: 'transparent', border: `1px solid ${c.border}`,
            borderRadius: '7px', padding: '8px 12px', color: c.muted,
            cursor: 'pointer', ...MONO_U, fontSize: '10px', textAlign: 'left',
            transition: 'border-color 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.muted }}>
            {adminToggleLabel}
          </button>
        </div>
      )}

      {/* Profile + settings */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: `${c.accent}33`, border: `1px solid ${c.accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>{user?.username?.[0]?.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...SERIF, fontSize: '14px', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
          <div style={{ ...SERIF, fontSize: '12px', color: c.muted, fontStyle: 'italic' }}>{user?.role}</div>
        </div>
        <button onClick={onSettings} title="Settings" style={{
          background: 'none', border: 'none', color: c.muted, cursor: 'pointer',
          fontSize: '17px', padding: '4px', borderRadius: '5px', transition: 'color 0.15s', flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.color = c.accent}
          onMouseLeave={e => e.currentTarget.style.color = c.muted}>
          ⚙
        </button>
      </div>
    </div>
  )
}
