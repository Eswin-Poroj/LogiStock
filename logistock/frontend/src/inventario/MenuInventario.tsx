import { NavLink } from 'react-router-dom'

export function MenuInventario({ escritura }: { escritura: boolean }) {
  return (
    <nav className="subnav" aria-label="Inventario">
      <NavLink to="/inventario" end>Existencias</NavLink>
      {escritura && <NavLink to="/inventario/entradas">Registrar entrada</NavLink>}
      {escritura && <NavLink to="/inventario/danio">Registrar daño</NavLink>}
      {escritura && <NavLink to="/inventario/ajustes">Registrar ajuste</NavLink>}
    </nav>
  )
}
