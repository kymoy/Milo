import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bgGrad: 'radial-gradient(ellipse at 60% 40%, #3d1a08 0%, #0a0a0a 65%)', text: '#fff', muted: '#bbb', border: 'rgba(255,107,43,0.35)', inputBg: 'rgba(255,255,255,0.07)', accent: '#ff6b2b', btnGrad: 'linear-gradient(135deg, #ff6b2b, #cc3300)' }
const LIGHT = { bgGrad: 'radial-gradient(ellipse at 60% 40%, #ff9966 0%, #fff8f4 70%)', text: '#1a0800', muted: '#885533', border: 'rgba(204,51,0,0.3)', inputBg: 'rgba(255,255,255,0.6)', accent: '#cc3300', btnGrad: 'linear-gradient(135deg, #ff6b2b, #cc3300)' }

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
      navigate(`/stokt/${data.role === 'admin' ? 'admin' : 'chat'}`)
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: c.bgGrad, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', transition: 'background 0.3s' }}>
      <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ ...MONO_U, fontSize: '14px', color: c.accent, marginBottom: '10px' }}>MILO</div>
        <div style={{ ...SERIF, fontSize: '34px', color: c.text, marginBottom: '44px', lineHeight: 1.2 }}>Welcome back.</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="text" placeholder="Username" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
            style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '15px 18px', color: c.text, fontSize: '16px', outline: 'none', fontFamily: 'system-ui' }}
            onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
          <input type="password" placeholder="Password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
            style={{ background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '15px 18px', color: c.text, fontSize: '16px', outline: 'none', fontFamily: 'system-ui' }}
            onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
          {error && <div style={{ ...SERIF, fontSize: '16px', color: c.accent }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background: c.btnGrad, border: 'none', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '18px', ...SERIF, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <button onClick={() => navigate('/')} style={{ ...SERIF, marginTop: '32px', background: 'none', border: 'none', color: c.muted, fontSize: '17px', cursor: 'pointer', fontStyle: 'italic' }}>← All themes</button>
      </div>
    </div>
  )
}
