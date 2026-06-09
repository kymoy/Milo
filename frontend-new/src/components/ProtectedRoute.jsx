import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false, loginPath = '/login' }) {
  const { user } = useAuth()

  if (!user) return <Navigate to={loginPath} replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/chat" replace />

  return children
}
