import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX = 64

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
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
      navigate(data.role === 'admin' ? '/admin' : '/firstframe/chat')
    } catch { setError('Could not reach server.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(160deg, #0d1520 0%, #080c10 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', letterSpacing: '3px', color: '#c8d8e8', textTransform: 'uppercase' }}>MILO</span>
          <span style={{ fontSize: '10px', letterSpacing: '2px', color: '#6a8aaa', textTransform: 'uppercase' }}>AI Interface</span>
        </div>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '20px' }}>Intelligent. Precise. Local.</div>
          <div style={{ fontSize: '52px', fontWeight: 200, color: '#c8d8e8', lineHeight: 1.1, letterSpacing: '-1px' }}>
            Ask anything.<br />
            <span style={{ color: '#6a9abb' }}>Know everything.</span>
          </div>
        </div>
        <div style={{ fontSize: '9px', color: '#5a7a9a', letterSpacing: '2px', textTransform: 'uppercase' }}>Motion-driven intelligence — Est. 2026</div>
      </div>

      <div style={{ width: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 40px', borderLeft: '1px solid #0d1520' }}>
        <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '40px' }}>Access</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '8px' }}>Username</div>
            <input type="text" maxLength={MAX} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #0d1f2e', padding: '10px 0', color: '#c8d8e8', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit', letterSpacing: '0.5px' }} />
          </div>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '8px' }}>Password</div>
            <input type="password" maxLength={MAX} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #0d1f2e', padding: '10px 0', color: '#c8d8e8', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit', letterSpacing: '0.5px' }} />
          </div>
          {error && <div style={{ fontSize: '11px', color: '#4a7a9a' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ marginTop: '8px', background: 'transparent', border: '1px solid #c8d8e8', padding: '13px', color: '#c8d8e8', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', opacity: loading ? 0.5 : 1 }}
            onMouseEnter={e => { e.target.style.background = '#c8d8e8'; e.target.style.color = '#080c10' }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#c8d8e8' }}>
            {loading ? 'Loading...' : 'Enter'}
          </button>
        </form>
        <button onClick={() => navigate('/')} style={{ marginTop: '40px', background: 'none', border: 'none', color: '#5a7a9a', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>← All themes</button>
      </div>
    </div>
  )
}


