import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './auth/Login'
import { useSesion } from './auth/sesion'
import { FormularioAjuste } from './inventario/FormularioAjuste'
import { FormularioDanio } from './inventario/FormularioDanio'
import { FormularioEntrada } from './inventario/FormularioEntrada'
import { Inicio } from './navegacion/Inicio'
import { PaginaModulo } from './navegacion/PaginaModulo'
import { Shell } from './navegacion/Shell'
import { FormularioPedido } from './pedidos/FormularioPedido'
import { TareaPicking } from './picking/TareaPicking'

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
      <Route path="/pedidos" element={<Privada><FormularioPedido /></Privada>} />
      <Route path="/inventario" element={<Privada><FormularioEntrada /></Privada>} />
      <Route path="/inventario/danio" element={<Privada><FormularioDanio /></Privada>} />
      <Route path="/inventario/ajustes" element={<Privada><FormularioAjuste /></Privada>} />
      <Route path="/picking" element={<Privada><PaginaModulo titulo="Picking" /></Privada>} />
      <Route path="/picking/tarea" element={<Privada><TareaPicking /></Privada>} />
      <Route path="/despachos" element={<Privada><PaginaModulo titulo="Despachos" /></Privada>} />
      <Route path="/despachos/nuevo" element={<Privada><PaginaModulo titulo="Crear despacho" /></Privada>} />
      <Route path="/despachos/entrega" element={<Privada><PaginaModulo titulo="Entrega" /></Privada>} />
      <Route path="/despachos/iniciar" element={<Privada><PaginaModulo titulo="Iniciar despacho" /></Privada>} />
      <Route path="/reportes" element={<Privada><PaginaModulo titulo="Reportes" /></Privada>} />
    </Routes>
  )
}
