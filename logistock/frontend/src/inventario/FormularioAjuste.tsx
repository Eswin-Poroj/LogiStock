import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { AjusteNuevo, Movimiento } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'

export function FormularioAjuste() {
  const { token, usuario } = useSesion()
  const [params] = useSearchParams()
  const [productoId, setProductoId] = useState(params.get('producto_id') ?? '')
  const [bodegaId, setBodegaId] = useState(params.get('bodega_id') ?? '')
  const [cantidadTexto, setCantidadTexto] = useState('0')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null)
  const cantidad = Number(cantidadTexto)
  const listo = esUuid(productoId) && esUuid(bodegaId) && Number.isInteger(cantidad) && cantidad !== 0 && motivo.trim().length > 0

  if (!usuario || accesoDe(usuario.rol, 'inventario') !== 'escritura') {
    return <p role="alert">Inventario es de solo lectura para tu rol.</p>
  }

  async function enviar() {
    if (!token || !listo) return
    setError(null)
    setMovimiento(null)
    const body: AjusteNuevo = {
      producto_id: productoId,
      bodega_id: bodegaId,
      tipo: 'ajuste',
      cantidad,
      motivo: motivo.trim(),
    }
    try {
      setMovimiento(await api<Movimiento>('/inventario/ajustes', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla">
      <MenuInventario escritura />
      <h1>Ajuste</h1>
      {error && <AvisoApi error={error} />}
      <label>
        Producto
        <input value={productoId} onChange={(evento) => setProductoId(evento.target.value)} />
      </label>
      <label>
        Bodega
        <input value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)} />
      </label>
      <label>
        Cantidad
        <input value={cantidadTexto} onChange={(evento) => setCantidadTexto(evento.target.value)} />
      </label>
      <label>
        Motivo
        <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
      </label>
      <button type="button" className="boton-primario" disabled={!listo} onClick={() => void enviar()}>Registrar ajuste</button>
      {movimiento && <p>Movimiento {movimiento.id}</p>}
      {movimiento && <p>Cantidad {movimiento.cantidad}</p>}
    </section>
  )
}
