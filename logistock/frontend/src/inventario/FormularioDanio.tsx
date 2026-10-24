import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { AjusteNuevo, Bodega, Movimiento, Producto } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'

export function FormularioDanio() {
  const { token, usuario } = useSesion()
  const [params] = useSearchParams()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const productos = useListado<Producto>('/productos', token)
  const [bodegaId, setBodegaId] = useState(params.get('bodega_id') ?? '')
  const [productoId, setProductoId] = useState(params.get('producto_id') ?? '')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null)
  const listaError = bodegas.error ?? productos.error
  const listo = esUuid(bodegaId) && esUuid(productoId) && Number.isInteger(cantidad) && cantidad >= 1 && motivo.trim().length > 0

  if (!usuario || accesoDe(usuario.rol, 'inventario') !== 'escritura') {
    return <p role="alert">Inventario es de solo lectura para tu rol.</p>
  }

  async function enviar() {
    if (!token || !listo) return
    setError(null)
    const body: AjusteNuevo = { producto_id: productoId, bodega_id: bodegaId, tipo: 'danio', cantidad, motivo: motivo.trim() }
    try {
      setMovimiento(await api<Movimiento>('/inventario/ajustes', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla">
      <MenuInventario escritura />
      <h1>Daño</h1>
      {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
      <label>
        Bodega
        <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
          <option value="">Selecciona</option>
          {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
        </select>
      </label>
      <label>
        Producto
        <select value={productoId} onChange={(evento) => setProductoId(evento.target.value)}>
          <option value="">Selecciona</option>
          {productos.items.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
        </select>
      </label>
      <label>
        Cantidad
        <input type="number" min={1} value={cantidad} onChange={(evento) => setCantidad(Number(evento.target.value))} />
      </label>
      <label>
        Motivo
        <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
      </label>
      <button type="button" className="boton-primario" disabled={!listo} onClick={() => void enviar()}>Registrar daño</button>
      {movimiento && <p>Movimiento {movimiento.id}</p>}
      {movimiento && <p>Cantidad {movimiento.cantidad}</p>}
    </section>
  )
}
