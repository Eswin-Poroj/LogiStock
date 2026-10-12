import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './auth/Login'
import { useSesion } from './auth/sesion'
import { Inicio } from './navegacion/Inicio'
import { PaginaModulo } from './navegacion/PaginaModulo'
import { Shell } from './navegacion/Shell'

function Privada({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Inicio />} />
      <Route path="/pedidos" element={<Privada><PaginaModulo titulo="Pedidos" /></Privada>} />
      <Route path="/inventario" element={<Privada><PaginaModulo titulo="Inventario" /></Privada>} />
      <Route path="/inventario/danio" element={<Privada><PaginaModulo titulo="Daño" /></Privada>} />
      <Route path="/inventario/ajustes" element={<Privada><PaginaModulo titulo="Ajuste" /></Privada>} />
      <Route path="/picking" element={<Privada><PaginaModulo titulo="Picking" /></Privada>} />
      <Route path="/picking/tarea" element={<Privada><PaginaModulo titulo="Tarea de picking" /></Privada>} />
      <Route path="/despachos" element={<Privada><PaginaModulo titulo="Despachos" /></Privada>} />
      <Route path="/despachos/nuevo" element={<Privada><PaginaModulo titulo="Crear despacho" /></Privada>} />
      <Route path="/despachos/entrega" element={<Privada><PaginaModulo titulo="Entrega" /></Privada>} />
      <Route path="/despachos/iniciar" element={<Privada><PaginaModulo titulo="Iniciar despacho" /></Privada>} />
      <Route path="/reportes" element={<Privada><PaginaModulo titulo="Reportes" /></Privada>} />
    </Routes>
  )
}
