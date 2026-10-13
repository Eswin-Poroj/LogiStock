import { Link } from 'react-router-dom'

export function MenuDespachos() {
  return (
    <nav aria-label="Despachos">
      <Link to="/despachos">Planificar</Link>
      <Link to="/despachos/seguimiento">Seguimiento</Link>
      <Link to="/despachos/iniciar">Iniciar</Link>
      <Link to="/despachos/entrega">Entrega</Link>
    </nav>
  )
}
