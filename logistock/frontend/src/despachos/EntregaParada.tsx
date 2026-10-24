import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { avanceEntregas, claseDespacho, etiquetaDespacho } from './estadoDespacho'
import { MenuDespachos } from './MenuDespachos'
import { ParadasDespacho } from './ParadasDespacho'
import { useDespachos } from './useDespachos'

/** CU-07: el chofer confirma cada parada de su ruta en curso. */
export function EntregaParada() {
  const { token } = useSesion()
  const [params] = useSearchParams()
  const enRuta = useDespachos(token, 'en_ruta')
  const [despachoId, setDespachoId] = useState(params.get('id') ?? '')
  const [actualizado, setActualizado] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const despacho = (actualizado?.id === despachoId ? actualizado : null) ?? enRuta.items.find((fila) => fila.id === despachoId) ?? null

  async function entregar(paradaId: string) {
    if (!token || !despachoId) return
    setError(null)
    try {
      setActualizado(await api<Despacho>(`/despachos/${despachoId}/paradas/${paradaId}/entregar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  const pendientes = despacho?.paradas.filter((parada) => !parada.entregada_at).length ?? 0

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Confirmar entregas">
        <MenuDespachos />
      </Encabezado>
      <div className="ficha">
        {(error ?? enRuta.error) && <AvisoApi error={(error ?? enRuta.error) as ApiError} />}
        <label>
          Despacho
          <select value={despachoId} onChange={(evento) => { setActualizado(null); setDespachoId(evento.target.value) }}>
            <option value="">Selecciona una ruta en curso</option>
            {enRuta.items.map((fila) => (
              <option key={fila.id} value={fila.id}>{fila.codigo} · {fila.conductor} · {avanceEntregas(fila)} entregadas</option>
            ))}
          </select>
        </label>
        {!enRuta.cargando && enRuta.items.length === 0 && !despacho && <p className="nota">No hay rutas en curso. Inicia una ruta planificada primero.</p>}
        {despacho && (
          <>
            <p>Estado <span className={claseDespacho(despacho.estado)}>{etiquetaDespacho(despacho.estado)}</span> · {avanceEntregas(despacho)} entregadas</p>
            <ParadasDespacho
              despacho={despacho}
              accion={(paradaId, orden) => (
                <button className="boton-confirmar" type="button" onClick={() => void entregar(paradaId)}>
                  {pendientes === 1 ? 'Confirmar entrega' : `Confirmar entrega ${orden}`}
                </button>
              )}
            />
          </>
        )}
        {despacho?.estado === 'finalizado' && <p className="nota-ok">Despacho finalizado</p>}
      </div>
    </section>
  )
}
