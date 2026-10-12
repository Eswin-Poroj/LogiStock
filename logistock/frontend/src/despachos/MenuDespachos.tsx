import { Link } from 'react-router-dom'

export function MenuDespachos() {
  return (
    <nav aria-label="Despachos">
      <Link to="/despachos">Listado</Link>
      <Link to="/despachos/nuevo">Crear</Link>
      <Link to="/despachos/entrega">Entrega</Link>
      <Link to="/despachos/iniciar">Iniciar</Link>
    </nav>
  )
}
