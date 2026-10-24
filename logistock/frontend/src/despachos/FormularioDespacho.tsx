import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, Conductor, Despacho, DespachoNuevo, PedidoResumen, Ruta, RutaSolicitud, Vehiculo } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'
import { textoDuracion } from './formatoRuta'

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
    api<PedidoResumen[]>('/pedidos?estado=en_preparacion&limite=20', { token })
      .then((filas) => { if (vivo) setPedidos(filas) })
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
    try {
      setDespacho(await api<Despacho>('/despachos', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla">
      <MenuDespachos />
      <h1>Planificar despacho y ruta</h1>
      {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
      <div className="despacho-rejilla">
        <div>
          <h2>Pedidos listos para despacho</h2>
          {pedidos.length === 0 && <p>No hay pedidos en preparación.</p>}
          <div className="lista-marcas">
            {pedidos.map((pedido) => (
              <label key={pedido.id}>
                <input type="checkbox" checked={marcados.includes(pedido.id)} onChange={() => alternar(pedido.id)} />
                {pedido.numero} {pedido.cliente}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="filtros">
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
            <label>
              Bodega
              <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
                <option value="">Selecciona</option>
                {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="acciones-despacho">
            <button type="button" disabled={!esUuid(bodegaId) || marcados.length === 0} onClick={() => void calcular()}>Calcular ruta</button>
          </div>
          <section className="ruta-panel" aria-label="Ruta propuesta">
            <h2>Ruta propuesta</h2>
            <button type="button" disabled={!esUuid(bodegaId) || marcados.length === 0} onClick={() => void calcular()}>Recalcular ruta</button>
            {ruta && <p>{ruta.distancia_km} km</p>}
            {ruta && <p>{textoDuracion(ruta.duracion_min)}</p>}
            {ruta && <p>{ruta.paradas.length}</p>}
            {ruta && <p>Motor: {ruta.proveedor}</p>}
            {ruta?.paradas.map((parada) => (
              <p className="parada" key={parada.pedido_id}>{parada.orden} <span>{parada.cliente}</span> {parada.direccion} <span>{parada.eta}</span></p>
            ))}
          </section>
          <button type="button" className="boton-primario" disabled={!listo} onClick={() => void asignar()}>Asignar despacho</button>
          {despacho && <p className="nota-ok">Despacho {despacho.codigo}</p>}
          {despacho && <p>Estado {despacho.estado}</p>}
          {despacho && <p>Los pedidos de las paradas pasan a Despachado.</p>}
        </div>
      </div>
    </section>
  )
}
