import { NavLink } from 'react-router-dom'

export function MenuPedidos() {
  return (
    <nav className="subnav" aria-label="Pedidos">
      <NavLink to="/pedidos" end>Nuevo pedido</NavLink>
      <NavLink to="/pedidos/lista">Pedidos</NavLink>
      <NavLink to="/pedidos/cotizaciones">Cotizaciones</NavLink>
    </nav>
  )
}
