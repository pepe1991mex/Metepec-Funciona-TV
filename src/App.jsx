import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginView from './components/LoginView'
import HomeView from './components/HomeView'
import AdminPanel from './components/AdminPanel'

const STORAGE_KEY = 'metepec_usuario'

export default function App() {
  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setUsuario(JSON.parse(saved)) } catch { localStorage.removeItem(STORAGE_KEY) }
    }
  }, [])

  const handleLogin = (user) => {
    setUsuario(user)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }

  const handleLogout = () => {
    setUsuario(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <Routes>
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/" element={
        usuario
          ? <HomeView usuario={usuario} onLogout={handleLogout} />
          : <LoginView onLogin={handleLogin} />
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
