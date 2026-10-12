import { Link } from 'react-router-dom'

export function MenuPicking() {
  return (
    <nav aria-label="Picking">
      <Link to="/picking">Tablero</Link>
      <Link to="/picking/tarea">Tarea</Link>
    </nav>
  )
}
