import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, EstadoStock, Existencia, InventarioRespuesta, Movimiento } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'

const ETIQUETA_MOVIMIENTO: Record<Movimiento['tipo'], string> = {
  entrada: 'Entrada',
  reserva: 'Reserva',
  liberacion: 'Liberación',
  despacho: 'Despacho',
  ajuste: 'Ajuste',
  danio: 'Daño',
  transferencia: 'Transferencia',
}

export function InventarioBodega() {
  const { token, usuario } = useSesion()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [bodegaId, setBodegaId] = useState(usuario?.bodega_id ?? '')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState<'' | EstadoStock>('')
  const [datos, setDatos] = useState<InventarioRespuesta | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [seleccionado, setSeleccionado] = useState<Existencia | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const escritura = !!usuario && accesoDe(usuario.rol, 'inventario') === 'escritura'

  useEffect(() => {
    if (!token || !esUuid(bodegaId)) return
    let vivo = true
    const params = new URLSearchParams({ bodega_id: bodegaId })
    if (q.trim()) params.set('q', q.trim())
    if (estado) params.set('estado', estado)
    api<InventarioRespuesta>(`/inventario?${params.toString()}`, { token })
      .then((respuesta) => { if (vivo) setDatos(respuesta) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, bodegaId, q, estado])

  async function abrir(item: Existencia) {
    if (!token || !esUuid(bodegaId)) return
    setSeleccionado(item)
    try {
      setMovimientos(await api<Movimiento[]>(`/inventario/${item.producto_id}/movimientos?bodega_id=${bodegaId}`, { token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <MenuInventario escritura={escritura} />
      <h1>Inventario por bodega</h1>
      {bodegas.error && <AvisoApi error={bodegas.error} />}
      {error && <AvisoApi error={error} />}
      <label>
        Bodega
        <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
          <option value="">Selecciona</option>
          {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
        </select>
      </label>
      <label>
        Buscar por SKU o producto
        <input value={q} onChange={(evento) => setQ(evento.target.value)} />
      </label>
      <label>
        Estado
        <select value={estado} onChange={(evento) => setEstado(evento.target.value as '' | EstadoStock)}>
          <option value="">Todos</option>
          <option value="normal">Normal</option>
          <option value="stock_bajo">Stock bajo</option>
          <option value="agotado">Agotado</option>
        </select>
      </label>
      {datos && (
        <div>
          <section aria-label="Disponible"><h2>Disponible</h2><p>{datos.totales.disponible}</p><p>unidades</p></section>
          <section aria-label="Reservado"><h2>Reservado</h2><p>{datos.totales.reservado}</p><p>por pedidos activos</p></section>
          <section aria-label="En tránsito"><h2>En tránsito</h2><p>{datos.totales.en_transito}</p><p>hacia la bodega</p></section>
          <section aria-label="Dañado"><h2>Dañado</h2><p>{datos.totales.danado}</p><p>fuera de venta</p></section>
        </div>
      )}
      {datos && datos.items.length === 0 && <p>No hay existencias con esos filtros.</p>}
      {datos && datos.items.length === 0 && (
        <button type="button" onClick={() => { setQ(''); setEstado('') }}>Limpiar filtros</button>
      )}
      <div className="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>PRODUCTO</th><th>UBICACIÓN</th><th>DISPONIBLE</th><th>RESERVADO</th><th>EN TRÁNSITO</th><th>DAÑADO</th>
            </tr>
          </thead>
          <tbody>
            {datos?.items.map((item) => (
              <tr key={item.producto_id}>
                <td><button type="button" onClick={() => void abrir(item)}>{item.sku} {item.nombre}</button></td>
                <td>{item.nombre}</td>
                <td>{item.ubicacion}</td>
                <td>{item.disponible}</td>
                <td>{item.reservado}</td>
                <td>{item.en_transito}</td>
                <td>{item.danado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {seleccionado && (
        <aside>
          <h2>{seleccionado.sku}</h2>
          <p>{seleccionado.nombre}</p>
          <p>Ubicación {seleccionado.ubicacion}</p>
          <ul>
            {movimientos.map((movimiento) => (
              <li key={movimiento.id}>
                <span>{ETIQUETA_MOVIMIENTO[movimiento.tipo]}</span>
                <span>{movimiento.referencia ?? ''}</span>
                <span>{movimiento.cantidad}</span>
                <span>{movimiento.created_at}</span>
              </li>
            ))}
          </ul>
          {escritura && (
            <>
              <Link to={`/inventario/ajustes?producto_id=${seleccionado.producto_id}&bodega_id=${bodegaId}`}>Registrar ajuste de este SKU</Link>
              <Link to={`/inventario/danio?producto_id=${seleccionado.producto_id}&bodega_id=${bodegaId}`}>Registrar daño de este SKU</Link>
            </>
          )}
        </aside>
      )}
    </section>
  )
}
