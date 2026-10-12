import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { moduloDeRuta, modulosDe } from './modulos'

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion()
  const lugar = useLocation()
  if (!usuario) return null
  const modulo = moduloDeRuta(lugar.pathname)
  const permitido = modulo ? modulo.roles.includes(usuario.rol) : true
  return (
    <>
      <header>
        <p>Sesión de {usuario.nombre}</p>
        <button type="button" onClick={salir}>Cerrar sesión</button>
      </header>
      <nav aria-label="Módulos">
        {modulosDe(usuario.rol).map((item) => (
          <Link key={item.id} to={item.ruta}>{item.etiqueta}</Link>
        ))}
      </nav>
      {permitido ? children : <p role="alert">No tienes acceso a este módulo.</p>}
    </>
  )
}
