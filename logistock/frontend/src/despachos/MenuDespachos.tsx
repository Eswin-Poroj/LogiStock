import { NavLink } from 'react-router-dom'

export function MenuDespachos() {
  return (
    <nav className="subnav" aria-label="Despachos">
      <NavLink to="/despachos" end>Planificar</NavLink>
      <NavLink to="/despachos/seguimiento">Seguimiento</NavLink>
      <NavLink to="/despachos/iniciar">Iniciar</NavLink>
      <NavLink to="/despachos/entrega">Entrega</NavLink>
    </nav>
  )
}
