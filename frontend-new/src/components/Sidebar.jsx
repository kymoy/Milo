import { useState } from 'react'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const PLACEHOLDER_CHATS = [
  'Who is Bill Cipher?',
  'Tell me about Dipper Pines',
  'What is the Mystery Shack?',
  'Explain the Journals',
  'What is Weirdmageddon?',
]

export default function Sidebar({ colors: c, user, onLogout, onSettings, onNewChat }) {
  const [activeChat, setActiveChat] = useState(0)

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      background: c.sidebar,
      borderRight: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${c.border}` }}>
        <div style={{ ...MONO_U, fontSize: '14px', color: c.accent, marginBottom: '14px' }}>MILO</div>
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
        <div style={{ ...SERIF, fontSize: '11px', color: c.muted, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingLeft: '8px' }}>Recent</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {PLACEHOLDER_CHATS.map((chat, i) => (
            <button key={i} onClick={() => setActiveChat(i)} style={{
              background: activeChat === i ? `${c.accent}15` : 'transparent',
              border: 'none', borderRadius: '7px', padding: '9px 10px',
              color: activeChat === i ? c.text : c.muted,
              fontSize: '14px', ...SERIF, cursor: 'pointer', textAlign: 'left',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              width: '100%', transition: 'background 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { if (activeChat !== i) e.currentTarget.style.background = `${c.accent}0d` }}
              onMouseLeave={e => { if (activeChat !== i) e.currentTarget.style.background = 'transparent' }}>
              {chat}
            </button>
          ))}
        </div>
      </div>

      {/* Profile + settings */}
      <div style={{ padding: '14px 16px', borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: `${c.accent}33`, border: `1px solid ${c.accent}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>{user?.username?.[0]?.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...SERIF, fontSize: '14px', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.username}</div>
          <div style={{ ...SERIF, fontSize: '12px', color: c.muted, fontStyle: 'italic' }}>{user?.role}</div>
        </div>
        <button onClick={onSettings} title="Settings" style={{
          background: 'none', border: 'none', color: c.muted, cursor: 'pointer',
          fontSize: '17px', padding: '4px', borderRadius: '5px', transition: 'color 0.15s',
          flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.color = c.accent}
          onMouseLeave={e => e.currentTarget.style.color = c.muted}>
          ⚙
        </button>
      </div>
    </div>
  )
}
