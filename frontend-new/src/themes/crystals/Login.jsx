import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 100, letterSpacing: '6px', textTransform: 'uppercase' }

const DARK  = { bg: '#000', text: '#fff', muted: '#aaa', border: '#333', btn: '#fff', btnText: '#000' }
const LIGHT = { bg: '#fff', text: '#000', muted: '#666', border: '#bbb', btn: '#000', btnText: '#fff' }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('dark')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const c = mode === 'dark' ? DARK : LIGHT

  async function handleSubmit(e) {
    e.preventDefault(); setError('')
    const u = username.trim(); const p = password.trim()
    if (!u || !p) return setError('All fields required.')
    if (u.length > MAX || p.length > MAX) return setError(`Max ${MAX} characters.`)
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })
      const data = await res.json()
      if (!res.ok) return setError(data.detail || 'Invalid credentials.')
      login({ username: u, role: data.role })
      navigate(data.role === 'admin' ? '/crystals/admin' : '/crystals/chat')
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  const inputStyle = {
    background: 'transparent', border: 'none', borderBottom: `1px solid ${c.border}`,
    padding: '13px 0', color: c.text, fontSize: '16px', outline: 'none', width: '100%', fontFamily: 'system-ui'
  }

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', transition: 'background 0.3s' }}>
      <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, letterSpacing: '3px', cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px', borderRight: `1px solid ${c.border}` }}>
        <div style={{ ...MONO_U, fontSize: '14px', color: c.text }}>MILO</div>
        <div>
          <div style={{ ...SERIF, fontSize: '18px', color: c.muted, fontStyle: 'italic', marginBottom: '40px' }}>Intelligent interface</div>
          <div style={{ ...SERIF, fontSize: '52px', color: c.text, lineHeight: 1.1, letterSpacing: '-1px' }}>Knowledge<br />on demand.</div>
        </div>
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted }}>© 2026 Milo</div>
      </div>

      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 48px' }}>
        <div style={{ ...SERIF, fontSize: '18px', color: c.muted, fontStyle: 'italic', marginBottom: '40px' }}>Sign in</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <input style={inputStyle} type="text" placeholder="Username" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
          <input style={{ ...inputStyle, type: 'password' }} type="password" placeholder="Password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <div style={{ ...SERIF, fontSize: '15px', color: '#e55' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background: c.btn, color: c.btnText, border: 'none', padding: '16px', fontSize: '13px', ...MONO_U, letterSpacing: '3px', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>
        <button onClick={() => navigate('/')} style={{ ...SERIF, marginTop: '40px', background: 'none', border: 'none', color: c.muted, fontSize: '16px', cursor: 'pointer', textAlign: 'left', fontStyle: 'italic' }}>← All themes</button>
      </div>
    </div>
  )
}

