import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex justify-center">
      <div className="flex flex-col w-full max-w-3xl h-screen bg-[#16161e]">

        <header className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a3a]">
          <span className="text-[#a78bfa] font-bold tracking-widest text-lg">MILO — Admin</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/chat')} className="text-[#6b6b8a] hover:text-[#a78bfa] text-sm transition-colors">
              Chat
            </button>
            <span className="text-[#6b6b8a] text-sm">{user?.username}</span>
            <button onClick={handleLogout} className="text-[#6b6b8a] hover:text-red-400 text-sm transition-colors">
              Sign out
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 flex flex-col gap-6">
          <h2 className="text-[#e8e8f0] text-xl font-semibold">Admin Panel</h2>
          <p className="text-[#6b6b8a] text-sm">Settings and controls will appear here in a future phase.</p>

          <div className="border border-[#2a2a3a] rounded-xl p-5 flex flex-col gap-2">
            <span className="text-[#a78bfa] text-sm font-semibold uppercase tracking-wider">Logged in as</span>
            <span className="text-[#e8e8f0]">{user?.username}</span>
            <span className="text-[#6b6b8a] text-xs">Role: {user?.role}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
