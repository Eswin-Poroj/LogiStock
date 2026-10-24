import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho, EstadoDespacho } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { avanceEntregas, claseDespacho, etiquetaDespacho } from './estadoDespacho'
import { textoDuracion } from './formatoRuta'
import { MenuDespachos } from './MenuDespachos'
import { useDespachos } from './useDespachos'

export function ListaDespachos() {
  const { token } = useSesion()
  const [estado, setEstado] = useState<EstadoDespacho | ''>('')
  const despachos = useDespachos(token, estado || undefined)
  const [error, setError] = useState<ApiError | null>(null)

  async function iniciar(id: string) {
    if (!token) return
    setError(null)
    try {
      const actualizado = await api<Despacho>(`/despachos/${id}/iniciar`, { method: 'POST', token })
      despachos.setItems((filas) => filas.map((fila) => fila.id === id ? actualizado : fila))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  const aviso = error ?? despachos.error

  return (
    <section className="pantalla">
      <Encabezado titulo="Seguimiento de despachos">
        <MenuDespachos />
      </Encabezado>
      <section className="tarjeta filtros">
        <label>
          Estado
          <select value={estado} onChange={(evento) => setEstado(evento.target.value as EstadoDespacho | '')}>
            <option value="">Todos</option>
            <option value="planificado">Planificado</option>
            <option value="en_ruta">En ruta</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </label>
      </section>
      {aviso && <AvisoApi error={aviso} />}
      <section className="tarjeta" aria-label="Despachos">
        <h2>Despachos</h2>
        {!despachos.cargando && despachos.items.length === 0 && !despachos.error && <p className="nota">No hay despachos con ese estado.</p>}
        {despachos.items.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr><th>Código</th><th>Estado</th><th>Vehículo</th><th>Conductor</th><th className="num">Entregas</th><th className="num">Distancia</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {despachos.items.map((despacho) => (
                  <tr key={despacho.id}>
                    <td className="sku">{despacho.codigo}</td>
                    <td><span className={claseDespacho(despacho.estado)}>{etiquetaDespacho(despacho.estado)}</span></td>
                    <td>{despacho.vehiculo}</td>
                    <td>{despacho.conductor}</td>
                    <td className="num">{avanceEntregas(despacho)}</td>
                    <td className="num">
                      {despacho.distancia_km != null ? `${despacho.distancia_km} km` : '—'}
                      {despacho.duracion_min != null && <small> · {textoDuracion(despacho.duracion_min)}</small>}
                    </td>
                    <td>
                      {despacho.estado === 'planificado' && (
                        <button type="button" aria-label={`Iniciar ruta ${despacho.codigo}`} onClick={() => void iniciar(despacho.id)}>Iniciar ruta</button>
                      )}
                      {despacho.estado === 'en_ruta' && <Link to={`/despachos/entrega?id=${despacho.id}`}>Confirmar entregas</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
