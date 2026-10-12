import { useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, Conductor, Despacho, DespachoNuevo, Ruta, RutaSolicitud, Vehiculo } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'

export function FormularioDespacho() {
  const { token } = useSesion()
  const vehiculos = useListado<Vehiculo>('/vehiculos', token)
  const conductores = useListado<Conductor>('/conductores', token)
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [vehiculoId, setVehiculoId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [pedidoId, setPedidoId] = useState('')
  const [ruta, setRuta] = useState<Ruta | null>(null)
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const listaError = vehiculos.error ?? conductores.error ?? bodegas.error
  const listo = esUuid(vehiculoId) && esUuid(conductorId) && esUuid(bodegaId) && esUuid(pedidoId)

  async function calcular() {
    if (!token || !esUuid(bodegaId) || !esUuid(pedidoId)) return
    setError(null)
    setRuta(null)
    const body: RutaSolicitud = { bodega_id: bodegaId, pedido_ids: [pedidoId] }
    try {
      setRuta(await api<Ruta>('/despachos/calcular-ruta', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function crear() {
    if (!token || !listo) return
    setError(null)
    const eta = ruta?.paradas.find((parada) => parada.pedido_id === pedidoId)?.eta
    const parada: { pedido_id: string; orden: number; eta?: string } = { pedido_id: pedidoId, orden: 1 }
    if (eta) parada.eta = eta
    const body: DespachoNuevo = { vehiculo_id: vehiculoId, conductor_id: conductorId, bodega_id: bodegaId, paradas: [parada] }
    try {
      setDespacho(await api<Despacho>('/despachos', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <MenuDespachos />
      <h1>Crear despacho</h1>
      {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
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
      <label>
        Pedido
        <input value={pedidoId} onChange={(evento) => setPedidoId(evento.target.value)} />
      </label>
      <button type="button" onClick={() => void calcular()}>Calcular ruta</button>
      <button type="button" disabled={!listo} onClick={() => void crear()}>Crear despacho</button>
      {ruta && <p>Distancia: {ruta.distancia_km} km</p>}
      {ruta && <p>Duración: {ruta.duracion_min} min</p>}
      {ruta?.paradas.map((parada) => <p key={parada.pedido_id}>ETA {parada.eta}</p>)}
      {despacho && <p>Despacho {despacho.codigo}</p>}
      {despacho && <p>Estado {despacho.estado}</p>}
    </section>
  )
}
