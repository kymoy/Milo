import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '5px', textTransform: 'uppercase' }
const T = MONO_U

function getTheme() {
  try { return JSON.parse(localStorage.getItem('milo_custom_theme')) } catch { return null }
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const c = getTheme() || { bg: '#0f0f13', accent: '#7c3aed', text: '#e8e8f0', userBubble: '#7c3aed', botBubble: '#1e1e2e', botText: '#e8e8f0' }
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      navigate(`/custom/${data.role === 'admin' ? 'admin' : 'chat'}`)
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  const borderColor = `${c.accent}33`
  const borderFocus = c.accent

  return (
    <div style={{ background: c.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ ...MONO_U, fontSize: '22px', fontWeight: 100, letterSpacing: '10px', color: c.accent, marginBottom: '10px' }}>MILO</div>
          <div style={{ ...SERIF, fontSize: '15px', color: `${c.text}88`, fontStyle: 'italic' }}>Sign in to continue</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ ...SERIF, fontSize: '13px', color: `${c.text}88`, fontStyle: 'italic', marginBottom: '8px' }}>Username</div>
            <input type="text" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
              style={{ background: `${c.accent}0d`, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '13px 16px', color: c.text, fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui' }}
              onFocus={e => e.target.style.borderColor = borderFocus} onBlur={e => e.target.style.borderColor = borderColor} />
          </div>
          <div>
            <div style={{ ...SERIF, fontSize: '13px', color: `${c.text}88`, fontStyle: 'italic', marginBottom: '8px' }}>Password</div>
            <input type="password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              style={{ background: `${c.accent}0d`, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '13px 16px', color: c.text, fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui' }}
              onFocus={e => e.target.style.borderColor = borderFocus} onBlur={e => e.target.style.borderColor = borderColor} />
          </div>
          {error && <div style={{ fontSize: '12px', color: c.accent, fontFamily: 'system-ui' }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ ...T, background: c.accent, border: 'none', borderRadius: '8px', padding: '14px', color: '#fff', fontSize: '9px', letterSpacing: '4px', fontWeight: 300, cursor: 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button onClick={() => navigate('/')} style={{ ...SERIF, display: 'block', margin: '28px auto 0', background: 'none', border: 'none', color: `${c.text}88`, fontSize: '14px', cursor: 'pointer', fontStyle: 'italic' }}>
          ← All themes
        </button>
      </div>
    </div>
  )
}

