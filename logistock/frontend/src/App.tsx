import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './auth/Login'
import { useSesion } from './auth/sesion'
import { FormularioDespacho } from './despachos/FormularioDespacho'
import { EntregaParada } from './despachos/EntregaParada'
import { IniciarDespacho } from './despachos/IniciarDespacho'
import { ListaDespachos } from './despachos/ListaDespachos'
import { FormularioAjuste } from './inventario/FormularioAjuste'
import { FormularioDanio } from './inventario/FormularioDanio'
import { FormularioEntrada } from './inventario/FormularioEntrada'
import { InventarioBodega } from './inventario/InventarioBodega'
import { Inicio } from './navegacion/Inicio'
import { Shell } from './navegacion/Shell'
import { FormularioPedido } from './pedidos/FormularioPedido'
import { DetallePedido } from './pedidos/DetallePedido'
import { TableroPicking } from './picking/TableroPicking'
import { TareaPicking } from './picking/TareaPicking'
import { Reportes } from './reportes/Reportes'
import { Catalogo } from './catalogo/Catalogo'
import { FlotaDespacho } from './despachos/FlotaDespacho'
import { Restablecer } from './auth/Restablecer'

function Privada({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  return <Shell>{children}</Shell>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/restablecer" element={<Restablecer />} />
      <Route path="/" element={<Inicio />} />
      <Route path="/pedidos/:id" element={<Privada><DetallePedido /></Privada>} />
      <Route path="/pedidos" element={<Privada><FormularioPedido /></Privada>} />
      <Route path="/inventario" element={<Privada><InventarioBodega /></Privada>} />
      <Route path="/inventario/entradas" element={<Privada><FormularioEntrada /></Privada>} />
      <Route path="/inventario/danio" element={<Privada><FormularioDanio /></Privada>} />
      <Route path="/inventario/ajustes" element={<Privada><FormularioAjuste /></Privada>} />
      <Route path="/picking" element={<Privada><TableroPicking /></Privada>} />
      <Route path="/picking/tarea" element={<Privada><TareaPicking /></Privada>} />
      <Route path="/despachos" element={<Privada><FormularioDespacho /></Privada>} />
      <Route path="/despachos/seguimiento" element={<Privada><ListaDespachos /></Privada>} />
      <Route path="/despachos/entrega" element={<Privada><EntregaParada /></Privada>} />
      <Route path="/despachos/iniciar" element={<Privada><IniciarDespacho /></Privada>} />
      <Route path="/despachos/flota" element={<Privada><FlotaDespacho /></Privada>} />
      <Route path="/reportes" element={<Privada><Reportes /></Privada>} />
      <Route path="/catalogo" element={<Privada><Catalogo /></Privada>} />
    </Routes>
  )
}
