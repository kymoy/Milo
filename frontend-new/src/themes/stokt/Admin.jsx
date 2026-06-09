import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import AdminContent from '../../components/AdminContent'
import { useAdminPanel } from '../../hooks/useAdminPanel'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)', sidebar: '#0a0604', border: 'rgba(255,107,43,0.2)', text: '#fff', muted: '#bbb', accent: '#ff6b2b', input: 'rgba(255,255,255,0.05)', botBubble: 'rgba(255,255,255,0.05)', userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botText: '#fff' }
const LIGHT = { bg: 'radial-gradient(ellipse at 70% 10%, #ff9966 0%, #fff8f4 70%)',   sidebar: '#ffe8d8', border: 'rgba(204,51,0,0.25)', text: '#1a0800', muted: '#885533', accent: '#cc3300', input: 'rgba(255,255,255,0.6)', botBubble: 'rgba(255,255,255,0.55)', userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botText: '#1a0800' }

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const admin = useAdminPanel()

  function handleLogout() { logout(); navigate('/stokt/login') }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => navigate('/stokt/chat')} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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

