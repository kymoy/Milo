import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from '../../components/SettingsPanel'
import AdminContent from '../../components/AdminContent'
import { useAdminPanel } from '../../hooks/useAdminPanel'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'linear-gradient(135deg, #1a1228 0%, #0f0a1e 100%)', sidebar: '#110c1c', border: 'rgba(196,181,253,0.15)', text: '#ede9fe', muted: '#b8a8e0', accent: '#c4b5fd', input: 'rgba(196,181,253,0.06)', botBubble: 'rgba(196,181,253,0.07)', userBubble: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', botText: '#c4b5fd' }
const LIGHT = { bg: 'linear-gradient(135deg, #f0ecff 0%, #e8e0ff 100%)', sidebar: '#e0d8f8', border: 'rgba(124,58,237,0.2)',  text: '#1a0a40', muted: '#7755bb', accent: '#6d28d9', input: 'rgba(124,58,237,0.05)', botBubble: 'rgba(124,58,237,0.06)', userBubble: 'linear-gradient(135deg,#a78bfa,#6d28d9)', botText: '#1a0a40' }

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? DARK : LIGHT
  const admin = useAdminPanel()

  function handleLogout() { logout(); navigate('/lavender/login') }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg }}>
      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={() => navigate('/lavender/chat')} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ ...MONO_U, fontSize: '11px', color: c.accent }}>MILO</span>
            <span style={{ color: c.border }}>|</span>
            <span style={{ ...SERIF, fontSize: '18px', color: c.text }}>Admin</span>
          </div>
          <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
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
