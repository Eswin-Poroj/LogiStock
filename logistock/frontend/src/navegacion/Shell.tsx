import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { accesoDe, moduloDeRuta, modulosDe } from './modulos'
import { migasDe } from './migas'
import { etiquetaRol } from './roles'

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion()
  const lugar = useLocation()
  if (!usuario) return null
  const modulo = moduloDeRuta(lugar.pathname)
  const permitido = modulo ? accesoDe(usuario.rol, modulo.id) !== 'ninguno' : true
  return (
    <div className="shell-app">
      <aside className="shell-lateral">
        <p className="shell-logo"><span>LS</span> LogiStock</p>
        <nav className="shell-nav" aria-label="Módulos">
          {modulosDe(usuario.rol).map((item) => (
            <Link key={item.id} to={item.ruta} aria-current={lugar.pathname.startsWith(item.ruta) ? 'page' : undefined}>{item.etiqueta}</Link>
          ))}
        </nav>
        <footer className="shell-pie">
          <p>{etiquetaRol(usuario.rol)}</p>
          <p>{usuario.bodega_nombre || 'Sin bodega asignada'}</p>
          <button type="button" onClick={salir}>Cerrar sesión</button>
        </footer>
      </aside>
      <div className="shell-cuerpo">
        <p className="migas">{migasDe(lugar.pathname)}</p>
        <main className="shell-contenido">
          {permitido ? children : <p role="alert">No tienes acceso a este módulo.</p>}
        </main>
      </div>
    </div>
  )
}
