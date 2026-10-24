import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { TareaPicking as Tarea } from '../dominio/tipos'
import { accesoDe } from '../navegacion/modulos'
import { Encabezado } from '../navegacion/Encabezado'
import { DetalleTarea } from './DetalleTarea'
import { leerTareas } from './leerTareas'
import { MenuPicking } from './MenuPicking'

export function TareaPicking() {
  const { token, usuario } = useSesion()
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const [abiertas, setAbiertas] = useState<Tarea[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const lectura = !usuario || accesoDe(usuario.rol, 'picking') !== 'escritura'

  useEffect(() => {
    if (!token || id) return
    let vivo = true
    api<unknown>('/picking/tareas', { token })
      .then((cuerpo) => {
        if (vivo) setAbiertas(leerTareas(cuerpo).filter((t) => t.estado === 'pendiente' || t.estado === 'en_curso'))
      })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, id])

  return (
    <section className="pantalla">
      <Encabezado titulo="Tarea de picking">
        <MenuPicking />
      </Encabezado>
      {lectura && <p>Picking es de solo lectura para tu rol.</p>}
      {!id && (
        <section className="tarjeta campos-despacho" aria-label="Elegir tarea">
          {error && <AvisoApi error={error} />}
          <label>
            Tarea
            <select value="" onChange={(evento) => { if (evento.target.value) setParams({ id: evento.target.value }) }}>
              <option value="">Selecciona un pedido por preparar</option>
              {abiertas.map((t) => (
                <option key={t.id} value={t.id}>{[t.numero_pedido ?? t.pedido_id, t.cliente].filter(Boolean).join(' · ')}</option>
              ))}
            </select>
          </label>
          {!error && abiertas.length === 0 && <p className="nota">No hay pedidos pendientes de preparar.</p>}
        </section>
      )}
      <DetalleTarea tareaId={id} lectura={lectura} onActualizada={() => undefined} />
    </section>
  )
}
