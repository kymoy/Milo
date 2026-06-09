import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import ThemePicker from './pages/ThemePicker'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Admin from './pages/Admin'

import CrystalsLogin from './themes/crystals/Login'
import CrystalsChat  from './themes/crystals/Chat'
import CrystalsAdmin from './themes/crystals/Admin'
import StiffLogin    from './themes/stiff/Login'
import StiffChat     from './themes/stiff/Chat'
import StiffAdmin    from './themes/stiff/Admin'
import StoktLogin    from './themes/stokt/Login'
import StoktChat     from './themes/stokt/Chat'
import StoktAdmin    from './themes/stokt/Admin'
import LavLogin      from './themes/lavender/Login'
import LavChat       from './themes/lavender/Chat'
import LavAdmin      from './themes/lavender/Admin'

function themed(LoginComp, ChatComp, AdminComp, prefix) {
  const loginPath = `/${prefix}/login`
  return [
    <Route key={`${prefix}-login`} path={`/${prefix}/login`} element={<LoginComp />} />,
    <Route key={`${prefix}-chat`}  path={`/${prefix}/chat`}  element={<ProtectedRoute loginPath={loginPath}><ChatComp /></ProtectedRoute>} />,
    <Route key={`${prefix}-admin`} path={`/${prefix}/admin`} element={<ProtectedRoute loginPath={loginPath} adminOnly><AdminComp /></ProtectedRoute>} />,
  ]
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ThemePicker />} />

          {/* Default theme */}
          <Route path="/login" element={<Login />} />
          <Route path="/chat"  element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />

          {/* Theme variants */}
          {themed(CrystalsLogin, CrystalsChat, CrystalsAdmin, 'crystals')}
          {themed(StiffLogin,    StiffChat,    StiffAdmin,    'stiff')}
          {themed(StoktLogin,    StoktChat,    StoktAdmin,    'stokt')}
          {themed(LavLogin,      LavChat,      LavAdmin,      'lavender')}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
