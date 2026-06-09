import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const IMPACT = { fontFamily: "'Impact', 'Arial Black', sans-serif", textTransform: 'uppercase' }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '4px', textTransform: 'uppercase' }

const DARK  = { bg: 'radial-gradient(ellipse at 30% 70%, #2a0e02 0%, #050508 60%)', text: '#f0ece4', muted: '#bb8855', border: '#2a1a0a', accent: '#ff7c45', btnGrad: 'linear-gradient(135deg, #ff7c45, #cc3300)' }
const LIGHT = { bg: 'radial-gradient(ellipse at 30% 70%, #fde8d0 0%, #faf5f0 60%)', text: '#1a0a00', muted: '#996644', border: '#e0c8a8', accent: '#cc4400', btnGrad: 'linear-gradient(135deg, #ff7c45, #cc3300)' }

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
      navigate(`/combined/${data.role === 'admin' ? 'admin' : 'chat'}`)
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', transition: 'background 0.3s' }}>
      <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}
        style={{ position: 'fixed', top: '24px', right: '28px', background: 'none', border: `1px solid ${c.border}`, borderRadius: '4px', padding: '8px 18px', color: c.muted, fontSize: '13px', ...MONO_U, cursor: 'pointer' }}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px', borderRight: `1px solid ${c.border}` }}>
        <div style={{ ...MONO_U, fontSize: '14px', color: c.accent }}>MILO</div>
        <div>
          <div style={{ ...SERIF, fontSize: '18px', color: c.muted, fontStyle: 'italic', marginBottom: '20px' }}>Motion-driven intelligence</div>
          <div style={{ ...IMPACT, fontSize: '56px', color: c.text, letterSpacing: '-2px', lineHeight: 1 }}>ASK</div>
          <div style={{ ...SERIF, fontSize: '56px', color: c.accent, lineHeight: 1, letterSpacing: '-1px' }}>anything.</div>
        </div>
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted }}>Est. 2026</div>
      </div>

      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 48px' }}>
        <div style={{ ...SERIF, fontSize: '18px', color: c.muted, fontStyle: 'italic', marginBottom: '40px' }}>Sign in</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{ ...SERIF, fontSize: '16px', color: c.muted, fontStyle: 'italic', marginBottom: '8px' }}>Username</div>
            <input type="text" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
              style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${c.border}`, padding: '12px 0', color: c.text, fontSize: '16px', outline: 'none', width: '100%', fontFamily: 'system-ui' }} />
          </div>
          <div>
            <div style={{ ...SERIF, fontSize: '16px', color: c.muted, fontStyle: 'italic', marginBottom: '8px' }}>Password</div>
            <input type="password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${c.border}`, padding: '12px 0', color: c.text, fontSize: '16px', outline: 'none', width: '100%', fontFamily: 'system-ui' }} />
          </div>
          {error && <div style={{ ...SERIF, fontSize: '16px', color: c.accent }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ background: c.btnGrad, border: 'none', padding: '16px', color: '#fff', fontSize: '18px', ...SERIF, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Entering...' : 'Enter'}
          </button>
        </form>
        <button onClick={() => navigate('/')} style={{ ...SERIF, marginTop: '40px', background: 'none', border: 'none', color: c.muted, fontSize: '16px', cursor: 'pointer', fontStyle: 'italic', textAlign: 'left' }}>← All themes</button>
      </div>
    </div>
  )
}

