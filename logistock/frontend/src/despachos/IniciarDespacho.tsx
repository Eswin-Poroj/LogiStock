import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { claseDespacho, etiquetaDespacho } from './estadoDespacho'
import { MenuDespachos } from './MenuDespachos'
import { ParadasDespacho } from './ParadasDespacho'
import { useDespachos } from './useDespachos'

/** CU-07 paso 1: el chofer abre su ruta planificada y la inicia. */
export function IniciarDespacho() {
  const { token } = useSesion()
  const planificados = useDespachos(token, 'planificado')
  const [despachoId, setDespachoId] = useState('')
  const [iniciado, setIniciado] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const despacho = iniciado ?? planificados.items.find((fila) => fila.id === despachoId) ?? null

  async function iniciar() {
    if (!token || !despachoId) return
    setError(null)
    try {
      setIniciado(await api<Despacho>(`/despachos/${despachoId}/iniciar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Iniciar ruta">
        <MenuDespachos />
      </Encabezado>
      <div className="ficha">
        {(error ?? planificados.error) && <AvisoApi error={(error ?? planificados.error) as ApiError} />}
        <label>
          Despacho
          <select value={despachoId} onChange={(evento) => { setIniciado(null); setDespachoId(evento.target.value) }}>
            <option value="">Selecciona una ruta planificada</option>
            {planificados.items.map((fila) => (
              <option key={fila.id} value={fila.id}>{fila.codigo} · {fila.conductor} · {fila.paradas.length} paradas</option>
            ))}
          </select>
        </label>
        {!planificados.cargando && planificados.items.length === 0 && !iniciado && <p className="nota">No hay rutas planificadas.</p>}
        {despacho && (
          <>
            <p>Estado <span className={claseDespacho(despacho.estado)}>{etiquetaDespacho(despacho.estado)}</span></p>
            <p className="nota">{despacho.vehiculo} · {despacho.conductor}</p>
            <ParadasDespacho despacho={despacho} />
          </>
        )}
        {despacho?.estado === 'en_ruta'
          ? <Link className="boton-primario" to={`/despachos/entrega?id=${despacho.id}`}>Ir a confirmar entregas</Link>
          : <button type="button" className="boton-primario" disabled={!despacho} onClick={() => void iniciar()}>Iniciar ruta</button>}
      </div>
    </section>
  )
}
