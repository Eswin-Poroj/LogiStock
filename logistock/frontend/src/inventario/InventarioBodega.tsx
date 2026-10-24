import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, EstadoStock, Existencia, InventarioRespuesta, Movimiento } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { Encabezado } from '../navegacion/Encabezado'
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

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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

  const bodegaNombre = bodegas.items.find((bodega) => bodega.id === bodegaId)?.nombre

  return (
    <section className="pantalla">
      <Encabezado titulo="Inventario por bodega">
        <MenuInventario escritura={escritura} />
      </Encabezado>
      {bodegas.error && <AvisoApi error={bodegas.error} />}
      {error && <AvisoApi error={error} />}
      <div className="filtros">
        <label>
          Bodega
          <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
            <option value="">Selecciona</option>
            {bodegas.items.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
          </select>
        </label>
        <label>
          Buscar por SKU o producto
          <input placeholder="Ej. FER-0012" value={q} onChange={(evento) => setQ(evento.target.value)} />
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
      </div>
      {datos && (
        <div className="indicadores">
          <section aria-label="Disponible"><h2>Disponible</h2><p>{datos.totales.disponible}</p><p>unidades</p></section>
          <section aria-label="Reservado"><h2>Reservado</h2><p>{datos.totales.reservado}</p><p>por pedidos activos</p></section>
          <section aria-label="En tránsito"><h2>En tránsito</h2><p>{datos.totales.en_transito}</p><p>hacia la bodega</p></section>
          <section aria-label="Dañado"><h2>Dañado</h2><p>{datos.totales.danado}</p><p>fuera de venta</p></section>
        </div>
      )}
      <div className="inventario-cuerpo">
        <section className="tarjeta" aria-labelledby="titulo-existencias">
          <h2 id="titulo-existencias">Existencias{bodegaNombre ? ` · ${bodegaNombre}` : ''}</h2>
          {datos && datos.items.length === 0 && <p>No hay existencias con esos filtros.</p>}
          {datos && datos.items.length === 0 && (
            <button type="button" onClick={() => { setQ(''); setEstado('') }}>Limpiar filtros</button>
          )}
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>SKU</th><th>Producto</th><th>Ubicación</th><th className="num">Disponible</th><th className="num">Reservado</th><th className="num">En tránsito</th><th className="num">Dañado</th>
                </tr>
              </thead>
              <tbody>
                {datos?.items.map((item) => (
                  <tr key={item.producto_id} className={seleccionado?.producto_id === item.producto_id ? 'fila-activa' : undefined}>
                    <td><button type="button" className="sku" aria-label={`${item.sku} ${item.nombre}`} onClick={() => void abrir(item)}>{item.sku}</button></td>
                    <td>{item.nombre}</td>
                    <td className="sku">{item.ubicacion}</td>
                    <td className="num">{item.disponible}</td>
                    <td className="num">{item.reservado}</td>
                    <td className="num">{item.en_transito}</td>
                    <td className="num">{item.danado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {seleccionado && (
          <aside className="tarjeta ficha-sku">
            <span className="sku">{seleccionado.sku}</span>
            <h2>{seleccionado.nombre}</h2>
            <p className="ubicacion">Ubicación {seleccionado.ubicacion}{bodegaNombre ? ` · ${bodegaNombre}` : ''}</p>
            <div className="mini-indicadores">
              <div><span>Disponible</span><strong>{seleccionado.disponible}</strong></div>
              <div><span>Reservado</span><strong>{seleccionado.reservado}</strong></div>
            </div>
            <h3>Movimientos recientes</h3>
            <ul className="movimientos">
              {movimientos.map((movimiento) => (
                <li key={movimiento.id}>
                  <span><span className="mov-tipo">{ETIQUETA_MOVIMIENTO[movimiento.tipo]}</span>{movimiento.referencia && <> · <span className="mov-ref">{movimiento.referencia}</span></>}</span>
                  <span className="mov-cantidad">{movimiento.cantidad > 0 ? `+${movimiento.cantidad}` : movimiento.cantidad}</span>
                  <span className="mov-fecha">{fechaCorta(movimiento.created_at)}</span>
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
      </div>
    </section>
  )
}
