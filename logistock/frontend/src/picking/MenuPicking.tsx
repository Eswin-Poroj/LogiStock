import { NavLink } from 'react-router-dom'

export function MenuPicking() {
  return (
    <nav className="subnav" aria-label="Picking">
      <NavLink to="/picking" end>Tablero</NavLink>
      <NavLink to="/picking/tarea">Tarea</NavLink>
    </nav>
  )
}
