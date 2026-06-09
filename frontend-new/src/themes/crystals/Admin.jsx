import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import AdminContent from '../../components/AdminContent'
import { useAdminPanel } from '../../hooks/useAdminPanel'

const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 100, letterSpacing: '6px', textTransform: 'uppercase' }

const DARK  = { bg: '#000', sidebar: '#080808', border: '#333', text: '#fff', muted: '#ccc', accent: '#fff', input: 'transparent', botBubble: '#0a0a0a', userBubble: '#fff', botText: '#e8e8e8' }
const LIGHT = { bg: '#fff', sidebar: '#f5f5f5', border: '#bbb',  text: '#000', muted: '#444', accent: '#000', input: 'transparent', botBubble: '#f9f9f9', userBubble: '#000', botText: '#222' }

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const admin = useAdminPanel()

  function handleLogout() { logout(); navigate('/crystals/login') }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => navigate('/crystals/chat')} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>MILO — Admin</div>
          <button onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
            style={{ ...MONO_U, background: 'none', border: `1px solid ${c.border}`, borderRadius: '2px', padding: '6px 14px', color: c.muted, fontSize: '10px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <AdminContent c={c} admin={admin} />
        </div>
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}

