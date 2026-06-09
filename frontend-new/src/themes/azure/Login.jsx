import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '5px', textTransform: 'uppercase' }

const DARK  = { bg: 'linear-gradient(135deg, #070d1a 0%, #0c1829 100%)', card: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.25)', text: '#e0eeff', muted: '#7099cc', accent: '#60a5fa', btnGrad: 'linear-gradient(135deg, #60a5fa, #1d4ed8)' }
const LIGHT = { bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', card: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.3)',  text: '#1e3a5f', muted: '#3b6cb0', accent: '#1d4ed8', btnGrad: 'linear-gradient(135deg, #60a5fa, #1d4ed8)' }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
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
      navigate(data.role === 'admin' ? '/azure/admin' : '/azure/chat')
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', transition: 'background 0.3s' }}>
      <button onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ display: 'inline-block', width: '48px', height: '48px', borderRadius: '50%', background: c.btnGrad, marginBottom: '20px' }} />
          <div style={{ ...MONO_U, fontSize: '20px', fontWeight: 100, letterSpacing: '10px', color: c.accent, marginBottom: '10px' }}>MILO</div>
          <div style={{ ...SERIF, fontSize: '18px', color: c.muted, fontStyle: 'italic' }}>Your intelligent assistant</div>
        </div>

        <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', padding: '34px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ ...SERIF, fontSize: '16px', color: c.muted, fontStyle: 'italic', marginBottom: '8px' }}>Username</div>
              <input type="text" placeholder="Enter username" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
                style={{ background: 'transparent', border: `1px solid ${c.border}`, borderRadius: '10px', padding: '14px 16px', color: c.text, fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui' }}
                onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
            </div>
            <div>
              <div style={{ ...SERIF, fontSize: '16px', color: c.muted, fontStyle: 'italic', marginBottom: '8px' }}>Password</div>
              <input type="password" placeholder="Enter password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                style={{ background: 'transparent', border: `1px solid ${c.border}`, borderRadius: '10px', padding: '14px 16px', color: c.text, fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui' }}
                onFocus={e => e.target.style.borderColor = c.accent} onBlur={e => e.target.style.borderColor = c.border} />
            </div>
            {error && <div style={{ ...SERIF, fontSize: '16px', color: '#f87171' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ background: c.btnGrad, border: 'none', borderRadius: '10px', padding: '15px', color: '#fff', fontSize: '18px', ...SERIF, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
        <button onClick={() => navigate('/')} style={{ ...SERIF, display: 'block', margin: '28px auto 0', background: 'none', border: 'none', color: c.muted, fontSize: '17px', cursor: 'pointer', fontStyle: 'italic' }}>← All themes</button>
      </div>
    </div>
  )
}

