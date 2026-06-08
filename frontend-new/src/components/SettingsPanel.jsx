import { useState } from 'react'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }

const ROW = (c) => ({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 0', borderBottom: `1px solid ${c.border}`,
})

function Toggle({ on, onToggle, accent, border, muted }) {
  return (
    <div onClick={onToggle} style={{
      width: '44px', height: '24px', borderRadius: '12px',
      background: on ? accent : 'transparent',
      border: `1px solid ${on ? accent : border}`,
      cursor: 'pointer', position: 'relative', transition: 'background 0.2s, border-color 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: '3px',
        left: on ? '22px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: on ? '#fff' : muted,
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

export default function SettingsPanel({ colors: c, user, onClose, onLogout, useLibrary, onToggleLibrary }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px',
        background: c.sidebar, borderLeft: `1px solid ${c.border}`,
        zIndex: 101, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...MONO_U, fontSize: '12px', color: c.accent }}>Settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          <div style={{ ...SERIF, fontSize: '12px', color: c.muted, fontStyle: 'italic', marginBottom: '12px', letterSpacing: '1px' }}>Profile</div>
          <div style={{ background: `${c.accent}10`, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '16px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `${c.accent}33`, border: `1px solid ${c.accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ ...MONO_U, fontSize: '14px', color: c.accent }}>{user?.username?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ ...SERIF, fontSize: '17px', color: c.text }}>{user?.username}</div>
              <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>

          <div style={{ ...SERIF, fontSize: '12px', color: c.muted, fontStyle: 'italic', marginBottom: '12px', letterSpacing: '1px' }}>System</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={ROW(c)}>
              <div>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>AI Model</div>
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>Ollama — llama3.2:3b</div>
              </div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
            </div>

            <div style={ROW(c)}>
              <div>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>Knowledge Library</div>
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>
                  {useLibrary ? 'Gravity Falls wiki' : 'Off — general knowledge'}
                </div>
              </div>
              <Toggle on={useLibrary} onToggle={onToggleLibrary} accent={c.accent} border={c.border} muted={c.muted} />
            </div>

            <div style={ROW(c)}>
              <div>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>Chat History</div>
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>Local only</div>
              </div>
              <div style={{ ...MONO_U, fontSize: '9px', color: c.muted, background: `${c.border}`, padding: '3px 8px', borderRadius: '4px' }}>Coming soon</div>
            </div>

            <div style={{ ...ROW(c), borderBottom: 'none' }}>
              <div>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>Notifications</div>
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>Off</div>
              </div>
              <div style={{ ...MONO_U, fontSize: '9px', color: c.muted, background: `${c.border}`, padding: '3px 8px', borderRadius: '4px' }}>Coming soon</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px', borderTop: `1px solid ${c.border}` }}>
          <button onClick={onLogout} style={{
            width: '100%', background: 'none', border: `1px solid ${c.border}`,
            borderRadius: '8px', padding: '12px', color: c.muted, cursor: 'pointer',
            ...SERIF, fontSize: '16px', transition: 'border-color 0.2s, color 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#e55'; e.currentTarget.style.color = '#e55' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.muted }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}
