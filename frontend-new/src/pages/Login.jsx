import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BACKEND = 'http://localhost:8000'
const MAX_LENGTH = 64

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const u = username.trim()
    const p = password.trim()

    if (!u || !p) return setError('Username and password are required.')
    if (u.length > MAX_LENGTH || p.length > MAX_LENGTH)
      return setError(`Fields must be ${MAX_LENGTH} characters or fewer.`)

    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.detail || 'Invalid credentials.')
      login({ username: u, role: data.role })
      navigate(data.role === 'admin' ? '/admin' : '/chat')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-full max-w-sm bg-[#16161e] border border-[#2a2a3a] rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-[#a78bfa] tracking-widest mb-1">MILO</h1>
        <p className="text-[#6b6b8a] text-sm mb-8">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            maxLength={MAX_LENGTH}
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-4 py-3 text-[#e8e8f0] text-sm outline-none focus:border-[#7c3aed]"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            maxLength={MAX_LENGTH}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-4 py-3 text-[#e8e8f0] text-sm outline-none focus:border-[#7c3aed]"
            autoComplete="current-password"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#3b3b52] text-white font-semibold rounded-lg py-3 text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
