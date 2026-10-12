import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './auth/Login'
import { useSesion } from './auth/sesion'

function Privada({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function App() {
  const { usuario } = useSesion()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privada><p>Sesión de {usuario?.nombre}</p></Privada>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
