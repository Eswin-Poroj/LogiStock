import { Link } from 'react-router-dom'

export function MenuInventario({ escritura }: { escritura: boolean }) {
  return (
    <nav aria-label="Inventario">
      <Link to="/inventario">Existencias</Link>
      {escritura && <Link to="/inventario/entradas">Registrar entrada</Link>}
      {escritura && <Link to="/inventario/danio">Registrar daño</Link>}
      {escritura && <Link to="/inventario/ajustes">Registrar ajuste</Link>}
    </nav>
  )
}
