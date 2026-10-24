import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { AjusteNuevo, Bodega, Existencia, Movimiento, Producto } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'
import { ResultadoMovimiento } from './ResultadoMovimiento'
import { stockActual } from './stockActual'
import { Encabezado } from '../navegacion/Encabezado'

export function FormularioAjuste() {
  const { token, usuario } = useSesion()
  const [params] = useSearchParams()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const productos = useListado<Producto>('/productos?limite=500', token)
  const [productoId, setProductoId] = useState(params.get('producto_id') ?? '')
  const [bodegaId, setBodegaId] = useState(params.get('bodega_id') ?? '')
  const [cantidadTexto, setCantidadTexto] = useState('0')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null)
  const [existencia, setExistencia] = useState<Existencia | null>(null)
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
      const registrado = await api<Movimiento>('/inventario/ajustes', { method: 'POST', token, body })
      setMovimiento(registrado)
      setExistencia(await stockActual(token, productoId, bodegaId))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Ajuste">
        <MenuInventario escritura />
      </Encabezado>
      <div className="ficha">
        {(bodegas.error ?? productos.error ?? error) && <AvisoApi error={(bodegas.error ?? productos.error ?? error) as ApiError} />}
        <label>
          Producto
          <select value={productoId} onChange={(evento) => setProductoId(evento.target.value)}>
            <option value="">Selecciona</option>
            {productos.items.map((producto) => <option key={producto.id} value={producto.id}>{producto.sku} · {producto.nombre}</option>)}
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
          Cantidad
          <input type="number" value={cantidadTexto} onChange={(evento) => setCantidadTexto(evento.target.value)} />
        </label>
        <p className="nota">Positiva suma al disponible; negativa resta. Para unidades dañadas usa Registrar daño.</p>
        <label>
          Motivo
          <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
        </label>
        <button type="button" className="boton-primario" disabled={!listo} onClick={() => void enviar()}>Registrar ajuste</button>
        {movimiento && <ResultadoMovimiento movimiento={movimiento} existencia={existencia} />}
      </div>
    </section>
  )
}
