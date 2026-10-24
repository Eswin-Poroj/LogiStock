import { NavLink } from 'react-router-dom'
import { useSesion } from '../auth/sesion'

export function MenuInventario({ escritura }: { escritura: boolean }) {
  const { usuario } = useSesion()
  return (
    <nav className="subnav" aria-label="Inventario">
      <NavLink to="/inventario" end>Existencias</NavLink>
      {escritura && <NavLink to="/inventario/entradas">Registrar entrada</NavLink>}
      {escritura && <NavLink to="/inventario/danio">Registrar daño</NavLink>}
      {escritura && <NavLink to="/inventario/ajustes">Registrar ajuste</NavLink>}
      {escritura && <NavLink to="/inventario/aprobaciones">{usuario?.rol === 'administrador' ? 'Aprobaciones' : 'Solicitudes'}</NavLink>}
    </nav>
  )
}
