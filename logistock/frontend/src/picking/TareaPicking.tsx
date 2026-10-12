import { useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { CompletarPicking, EscaneoNuevo, TareaPicking as Tarea } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuPicking } from './MenuPicking'

export function TareaPicking() {
  const { token } = useSesion()
  const [tareaId, setTareaId] = useState('')
  const [sku, setSku] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [faltante, setFaltante] = useState(false)
  const [nota, setNota] = useState('')
  const [tarea, setTarea] = useState<Tarea | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  async function cargar() {
    if (!token || !esUuid(tareaId)) return
    setError(null)
    try {
      setTarea(await api<Tarea>(`/picking/tareas/${tareaId}`, { token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function escanear() {
    if (!token || !esUuid(tareaId) || sku.trim() === '' || !Number.isInteger(cantidad) || cantidad < 1) return
    setError(null)
    const body: EscaneoNuevo = { sku: sku.trim(), cantidad }
    try {
      setTarea(await api<Tarea>(`/picking/tareas/${tareaId}/escaneos`, { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function completar() {
    if (!token || !esUuid(tareaId)) return
    setError(null)
    const body: CompletarPicking = { faltante }
    if (nota.trim()) body.nota = nota.trim()
    try {
      setTarea(await api<Tarea>(`/picking/tareas/${tareaId}/completar`, { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <MenuPicking />
      <h1>Tarea de picking</h1>
      {error && <AvisoApi error={error} />}
      <label>
        Tarea
        <input value={tareaId} onChange={(evento) => setTareaId(evento.target.value)} />
      </label>
      <button type="button" onClick={() => void cargar()}>Cargar tarea</button>
      {tarea && <p>Estado {tarea.estado}</p>}
      {tarea?.lineas.map((linea) => (
        <p key={linea.pedido_linea_id}>{linea.sku} {linea.nombre} {linea.cantidad_recogida}/{linea.cantidad}{linea.ubicacion ? ` ${linea.ubicacion}` : ''}</p>
      ))}
      <label>
        SKU
        <input value={sku} onChange={(evento) => setSku(evento.target.value)} />
      </label>
      <label>
        Cantidad
        <input type="number" min={1} value={cantidad} onChange={(evento) => setCantidad(Number(evento.target.value))} />
      </label>
      <button type="button" onClick={() => void escanear()}>Registrar escaneo</button>
      <label>
        Faltante
        <input type="checkbox" checked={faltante} onChange={(evento) => setFaltante(evento.target.checked)} />
      </label>
      <label>
        Nota
        <input value={nota} onChange={(evento) => setNota(evento.target.value)} />
      </label>
      <button type="button" onClick={() => void completar()}>Completar</button>
    </section>
  )
}
