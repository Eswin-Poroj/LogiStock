import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { accesoDe, moduloDeRuta, modulosDe } from './modulos'
import { migasDe } from './migas'
import { etiquetaRol } from './roles'
import { Avisos } from './Avisos'

/** "Ada Lovelace" → "AL"; una sola palabra → sus dos primeras letras. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

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
        <p className="shell-seccion" aria-hidden="true">Módulos</p>
        <nav className="shell-nav" aria-label="Módulos">
          {modulosDe(usuario.rol).map((item) => (
            <Link key={item.id} to={item.ruta} aria-current={lugar.pathname.startsWith(item.ruta) ? 'page' : undefined}>{item.etiqueta}</Link>
          ))}
        </nav>
        <Avisos />
        <footer className="shell-pie">
          <div className="shell-usuario">
            <span className="shell-avatar" aria-hidden="true">{iniciales(usuario.nombre)}</span>
            <div>
              <p className="shell-nombre">{usuario.nombre}</p>
              <p>{etiquetaRol(usuario.rol)}</p>
            </div>
          </div>
          <p className="shell-bodega">{usuario.bodega_nombre || 'Sin bodega asignada'}</p>
          <button type="button" className="shell-salir" onClick={salir}>Cerrar sesión</button>
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
