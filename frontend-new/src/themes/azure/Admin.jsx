import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import AdminContent from '../../components/AdminContent'
import { useAdminPanel } from '../../hooks/useAdminPanel'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'linear-gradient(135deg, #0d1b35 0%, #162040 100%)', sidebar: '#0f1e38', border: 'rgba(96,165,250,0.25)', text: '#e8f0ff', muted: '#90b8f0', accent: '#60a5fa', input: 'rgba(96,165,250,0.08)', userBubble: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', botBubble: 'rgba(59,130,246,0.14)', botText: '#bcd9ff' }
const LIGHT = { bg: 'linear-gradient(135deg, #5e8ec4 0%, #3d6fa8 100%)', sidebar: '#4e7eb4', border: 'rgba(29,78,216,0.45)', text: '#071428', muted: '#0d3570', accent: '#1d4ed8', input: 'rgba(255,255,255,0.18)', userBubble: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', botBubble: 'rgba(255,255,255,0.18)', botText: '#071428' }

const GLOWS = [
  { top: '5%',  left: '35%', size: '520px', color: 'rgba(59,130,246,0.11)',  blur: '110px' },
  { bottom: '12%', right: '18%', size: '400px', color: 'rgba(99,102,241,0.09)', blur: '85px'  },
  { top: '58%', left: '6%',  size: '300px', color: 'rgba(147,197,253,0.08)', blur: '65px'  },
]

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const admin = useAdminPanel()

  function handleLogout() { logout(); navigate('/azure/login') }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg, position: 'relative', overflow: 'hidden' }}>

      {mode === 'dark' && GLOWS.map((g, i) => (
        <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: g.color, filter: `blur(${g.blur})`, pointerEvents: 'none', width: g.size, height: g.size, top: g.top, bottom: g.bottom, left: g.left, right: g.right }} />
      ))}

      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => navigate('/azure/chat')} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>MILO</span>
            <span style={{ color: c.border }}>|</span>
            <span style={{ ...SERIF, fontSize: '18px', color: c.text }}>Admin</span>
          </div>
          <button onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
          <AdminContent c={c} admin={admin} />
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}
