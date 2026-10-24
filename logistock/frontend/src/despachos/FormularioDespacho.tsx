import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, Conductor, Despacho, DespachoNuevo, PedidoResumen, Ruta, RutaSolicitud, TareaPicking, Vehiculo } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'
import { quetzales } from '../dominio/quetzales'
import { Encabezado } from '../navegacion/Encabezado'
import { MapaRuta } from './MapaRuta'
import { horaDe, textoDuracion } from './formatoRuta'

export function FormularioDespacho() {
  const { token } = useSesion()
  const vehiculos = useListado<Vehiculo>('/vehiculos', token)
  const conductores = useListado<Conductor>('/conductores', token)
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [vehiculoId, setVehiculoId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const [marcados, setMarcados] = useState<string[]>([])
  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const listaError = vehiculos.error ?? conductores.error ?? bodegas.error
  const listo = esUuid(vehiculoId) && esUuid(conductorId) && esUuid(bodegaId) && marcados.length > 0

  useEffect(() => {
    if (!token) return
    let vivo = true
    // CU-06: listos = en preparación y con el picking completado.
    Promise.all([
      api<PedidoResumen[]>('/pedidos?estado=en_preparacion&limite=100', { token }),
      api<TareaPicking[]>('/picking/tareas?estado=completado', { token }),
    ])
      .then(([filas, tareas]) => {
        if (!vivo) return
        const completados = new Set(tareas.map((tarea) => tarea.pedido_id))
        setPedidos(filas.filter((fila) => completados.has(fila.id)))
      })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  function alternar(id: string) {
    setRuta(null)
    setMarcados((actual) => actual.includes(id) ? actual.filter((fila) => fila !== id) : [...actual, id])
  }

  async function calcular() {
    if (!token || !esUuid(bodegaId) || marcados.length === 0) return
    setError(null)
    setRuta(null)
    const body: RutaSolicitud = { bodega_id: bodegaId, pedido_ids: marcados }
    try {
      setRuta(await api<Ruta>('/despachos/calcular-ruta', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function asignar() {
    if (!token || !listo) return
    setError(null)
    const paradas = ruta
      ? ruta.paradas.map((parada) => {
          const fila: { pedido_id: string; orden: number; eta?: string } = { pedido_id: parada.pedido_id, orden: parada.orden }
          if (parada.eta) fila.eta = parada.eta
          return fila
        })
      : marcados.map((pedidoId, indice) => ({ pedido_id: pedidoId, orden: indice + 1 }))
    const body: DespachoNuevo = { vehiculo_id: vehiculoId, conductor_id: conductorId, bodega_id: bodegaId, paradas }
    if (ruta) {
      body.distancia_km = ruta.distancia_km
      body.duracion_min = ruta.duracion_min
    }
    try {
      const creado = await api<Despacho>('/despachos', { method: 'POST', token, body })
      setDespacho(creado)
      const asignados = new Set(creado.paradas.map((parada) => parada.pedido_id))
      setPedidos((actuales) => actuales.filter((pedido) => !asignados.has(pedido.id)))
      setMarcados([])
      setRuta(null)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla">
      <Encabezado titulo="Planificar despacho y ruta">
        <MenuDespachos />
      </Encabezado>
      {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
      <div className="despacho-rejilla">
        <div className="despacho-izquierda">
          <section className="tarjeta" aria-labelledby="titulo-listos">
            <h2 id="titulo-listos">Pedidos listos para despacho</h2>
            {pedidos.length === 0 && <p className="nota">No hay pedidos con el picking completado.</p>}
            <div className="lista-marcas">
              {pedidos.map((pedido) => (
                <label key={pedido.id}>
                  <input type="checkbox" checked={marcados.includes(pedido.id)} onChange={() => alternar(pedido.id)} />
                  <span>
                    <span className="numero">{pedido.numero}</span> {pedido.cliente}
                    <small>{quetzales(pedido.total)}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="tarjeta" aria-labelledby="titulo-vehiculo">
            <h2 id="titulo-vehiculo">Vehículo y conductor</h2>
            <div className="campos-despacho">
              <label>
                Bodega
                <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
                  <option value="">Selecciona</option>
                  {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
                </select>
              </label>
              <label>
                Vehículo
                <select value={vehiculoId} onChange={(evento) => setVehiculoId(evento.target.value)}>
                  <option value="">Selecciona</option>
                  {vehiculos.items.map((vehiculo) => <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.nombre}</option>)}
                </select>
              </label>
              <label>
                Conductor
                <select value={conductorId} onChange={(evento) => setConductorId(evento.target.value)}>
                  <option value="">Selecciona</option>
                  {conductores.items.map((conductor) => <option key={conductor.id} value={conductor.id}>{conductor.nombre}</option>)}
                </select>
              </label>
              <button type="button" disabled={!esUuid(bodegaId) || marcados.length === 0} onClick={() => void calcular()}>Calcular ruta</button>
            </div>
          </section>
        </div>
        <div className="despacho-derecha">
          <section className="tarjeta ruta-panel" aria-label="Ruta propuesta">
            <div className="tarjeta-titulo">
              <h2>Ruta propuesta</h2>
              <button type="button" disabled={!esUuid(bodegaId) || marcados.length === 0} onClick={() => void calcular()}>Recalcular ruta</button>
            </div>
            <MapaRuta ruta={ruta} />
            {ruta && (
              <>
                <div className="metricas-ruta">
                  <div><span>Distancia</span><strong>{ruta.distancia_km} km</strong></div>
                  <div><span>Duración</span><strong>{textoDuracion(ruta.duracion_min)}</strong></div>
                  <div><span>Paradas</span><strong>{ruta.paradas.length}</strong></div>
                </div>
                <p className="nota">Motor: {ruta.proveedor}</p>
                <h3>Orden de entrega</h3>
                <ol className="orden-entrega">
                  {ruta.paradas.map((parada) => (
                    <li className="parada" key={parada.pedido_id}>
                      <span className="orden">{parada.orden}</span>
                      <span><strong>{parada.cliente}</strong><small>{parada.direccion}</small></span>
                      <span className="hora">{horaDe(parada.eta)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
          <div className="acciones-despacho">
            <button type="button" className="boton-primario" disabled={!listo} onClick={() => void asignar()}>Asignar despacho</button>
          </div>
          {despacho && <p className="nota-ok">Despacho {despacho.codigo}</p>}
          {despacho && <p>Estado {despacho.estado}</p>}
          {despacho && <p>Los pedidos de las paradas pasan a Despachado. <Link to={`/despachos/seguimiento`}>Ver en seguimiento</Link></p>}
        </div>
      </div>
    </section>
  )
}
