import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const IMPACT = { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: 'uppercase' }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }

const DARK  = { bg: '#12121e', text: '#f5f0e8', muted: '#aaa', border: '#2a2a40', inputBg: '#1c1c2e', accent: '#cc2200' }
const LIGHT = { bg: '#f5f0e8', text: '#12121e', muted: '#666', border: '#c8c0b8', inputBg: '#ece8e0', accent: '#cc2200' }

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
      navigate(`/stiff/${data.role === 'admin' ? 'admin' : 'chat'}`)
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', transition: 'background 0.3s' }}>
      <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ ...IMPACT, fontSize: '56px', color: c.text, letterSpacing: '-2px', lineHeight: 1, marginBottom: '6px' }}>MILO</div>
        <div style={{ ...SERIF, fontSize: '18px', color: c.accent, fontStyle: 'italic', marginBottom: '44px' }}>Sign in to continue</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="text" placeholder="Username" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
            style={{ background: c.inputBg, border: `2px solid ${c.border}`, borderRadius: '4px', padding: '15px 16px', color: c.text, fontSize: '16px', outline: 'none', fontFamily: 'system-ui' }}
            onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
          <input type="password" placeholder="Password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
            style={{ background: c.inputBg, border: `2px solid ${c.border}`, borderRadius: '4px', padding: '15px 16px', color: c.text, fontSize: '16px', outline: 'none', fontFamily: 'system-ui' }}
            onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
          {error && <div style={{ ...SERIF, fontSize: '15px', color: c.accent }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background: c.accent, border: 'none', borderRadius: '4px', padding: '16px', color: '#fff', fontSize: '14px', ...MONO_U, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <button onClick={() => navigate('/')} style={{ ...SERIF, marginTop: '32px', background: 'none', border: 'none', color: c.muted, fontSize: '16px', cursor: 'pointer', fontStyle: 'italic' }}>← All themes</button>
      </div>
    </div>
  )
}
