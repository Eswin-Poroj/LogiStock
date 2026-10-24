import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/cliente'
import { useSesion } from '../auth/sesion'

export interface Aviso {
  id: string
  tipo: string
  mensaje: string
  pedido_id: string | null
  leida: boolean
  created_at: string
}

const CADA_MS = 30_000

function hace(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `hace ${h} h` : new Date(iso).toLocaleDateString('es-GT')
}

/** CU-05 E2: avisos del usuario (p. ej., picking con faltante para el asesor). Consulta cada 30 s. */
export function Avisos() {
  const { token } = useSesion()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [abierto, setAbierto] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const sinLeer = avisos.filter((a) => !a.leida).length

  const cargar = useCallback(async () => {
    if (!token) return
    try {
      const filas = await api<Aviso[]>('/notificaciones', { token })
      if (Array.isArray(filas)) setAvisos(filas)
    } catch {
      // Sin avisos disponibles no se bloquea la navegación.
    }
  }, [token])

  useEffect(() => {
    void cargar()
    const reloj = window.setInterval(() => { void cargar() }, CADA_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { window.clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar])

  useEffect(() => {
    if (!abierto) return
    const fuera = (evento: MouseEvent) => { if (panel.current && !panel.current.contains(evento.target as Node)) setAbierto(false) }
    const escape = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape) }
  }, [abierto])

  async function leer(aviso: Aviso) {
    if (!token || aviso.leida) return
    setAvisos((filas) => filas.map((fila) => fila.id === aviso.id ? { ...fila, leida: true } : fila))
    await api(`/notificaciones/${aviso.id}/leida`, { method: 'POST', token }).catch(() => undefined)
  }

  async function leerTodas() {
    if (!token) return
    setAvisos((filas) => filas.map((fila) => ({ ...fila, leida: true })))
    await api('/notificaciones/leidas', { method: 'POST', token }).catch(() => undefined)
  }

  return (
    <div className="avisos" ref={panel}>
      <button
        type="button"
        className="avisos-boton"
        aria-expanded={abierto}
        aria-label={sinLeer ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <span className="avisos-texto">Avisos</span>
        {sinLeer > 0 && <span className="avisos-cuenta" aria-hidden="true">{sinLeer}</span>}
      </button>
      {abierto && (
        <div className="avisos-panel" role="dialog" aria-label="Avisos">
          <div className="avisos-titulo">
            <strong>Avisos</strong>
            {sinLeer > 0 && <button type="button" onClick={() => void leerTodas()}>Marcar todo como leído</button>}
          </div>
          {avisos.length === 0 && <p className="nota">No tienes avisos.</p>}
          <ul>
            {avisos.map((a) => (
              <li key={a.id} className={a.leida ? undefined : 'sin-leer'}>
                <p>{a.mensaje}</p>
                <small>
                  {hace(a.created_at)}
                  {a.pedido_id && <> · <Link to={`/pedidos/${a.pedido_id}`} onClick={() => { void leer(a); setAbierto(false) }}>Ver pedido</Link></>}
                  {!a.leida && <> · <button type="button" onClick={() => void leer(a)}>Marcar leído</button></>}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
