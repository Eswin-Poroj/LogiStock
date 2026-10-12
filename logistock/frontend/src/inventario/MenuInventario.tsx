import { Link } from 'react-router-dom'

export function MenuInventario() {
  return (
    <nav aria-label="Inventario">
      <Link to="/inventario">Entrada</Link>
      <Link to="/inventario/danio">Daño</Link>
      <Link to="/inventario/ajustes">Ajuste</Link>
    </nav>
  )
}
