import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { accesoDe, moduloDeRuta, modulosDe } from './modulos'

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion()
  const lugar = useLocation()
  if (!usuario) return null
  const modulo = moduloDeRuta(lugar.pathname)
  const permitido = modulo ? accesoDe(usuario.rol, modulo.id) !== 'ninguno' : true
  return (
    <div className="shell-app">
      <header>
        <p>Sesión de {usuario.nombre}</p>
        <button type="button" onClick={salir}>Cerrar sesión</button>
      </header>
      <nav className="shell-nav" aria-label="Módulos">
        {modulosDe(usuario.rol).map((item) => (
          <Link key={item.id} to={item.ruta} aria-current={lugar.pathname.startsWith(item.ruta) ? 'page' : undefined}>{item.etiqueta}</Link>
        ))}
      </nav>
      <main className="shell-contenido">
        {permitido ? children : <p role="alert">No tienes acceso a este módulo.</p>}
      </main>
    </div>
  )
}
