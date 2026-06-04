import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import ThemePicker from './pages/ThemePicker'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Admin from './pages/Admin'

import CrystalsLogin from './themes/crystals/Login'
import CrystalsChat  from './themes/crystals/Chat'
import StiffLogin    from './themes/stiff/Login'
import StiffChat     from './themes/stiff/Chat'
import StoktLogin    from './themes/stokt/Login'
import StoktChat     from './themes/stokt/Chat'
import CombLogin     from './themes/combined/Login'
import CombChat      from './themes/combined/Chat'
import LavLogin      from './themes/lavender/Login'
import LavChat       from './themes/lavender/Chat'
import CustLogin     from './themes/custom/Login'
import CustChat      from './themes/custom/Chat'

function themed(LoginComp, ChatComp, prefix) {
  return [
    <Route key={`${prefix}-login`} path={`/${prefix}/login`} element={<LoginComp />} />,
    <Route key={`${prefix}-chat`}  path={`/${prefix}/chat`}  element={<ProtectedRoute><ChatComp /></ProtectedRoute>} />,
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
          {themed(CrystalsLogin, CrystalsChat, 'crystals')}
          {themed(StiffLogin,    StiffChat,    'stiff')}
          {themed(StoktLogin,    StoktChat,    'stokt')}
          {themed(CombLogin,     CombChat,     'combined')}
          {themed(LavLogin,      LavChat,      'lavender')}
          {themed(CustLogin,     CustChat,     'custom')}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
