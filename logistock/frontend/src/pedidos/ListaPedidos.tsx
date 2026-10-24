import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { BuscadorTabla } from '../comun/Paginador'
import { POR_PAGINA, eliminarConConfirmacion } from '../comun/paginar'
import { quetzales } from '../dominio/quetzales'
import type { EstadoPedido, PedidoResumen } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { etiquetaEstadoPedido, puedeCancelarPedido } from './estadosPedido'
import { MenuPedidos } from './MenuPedidos'

function clasePedido(estado: EstadoPedido): string {
  if (estado === 'entregado') return 'pastilla pastilla-ok'
  if (estado === 'cancelado') return 'pastilla pastilla-error'
  if (estado === 'despachado') return 'pastilla pastilla-alerta'
  return 'pastilla pastilla-info'
}

/** Pedidos con paginación del servidor; cancelar libera stock (CU-08) y solo un cancelado se elimina. */
export function ListaPedidos() {
  const { token, usuario } = useSesion()
  const [estado, setEstado] = useState<EstadoPedido | ''>('')
  const [pagina, setPagina] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => { setPagina(1) }, [estado])

  useEffect(() => {
    if (!token) return
    let vivo = true
    const params = new URLSearchParams({ pagina: String(pagina), limite: String(POR_PAGINA) })
    if (estado) params.set('estado', estado)
    api<PedidoResumen[]>(`/pedidos?${params}`, { token })
      .then((filas) => { if (vivo) setPedidos(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, estado, pagina])

  async function cancelar(pedido: PedidoResumen) {
    if (!token || !window.confirm(`¿Cancelar ${pedido.numero}? El stock reservado vuelve a estar disponible.`)) return
    setError(null)
    try {
      await api(`/pedidos/${pedido.id}/cancelar`, { method: 'POST', token })
      setPedidos((filas) => filas.map((fila) => fila.id === pedido.id ? { ...fila, estado: 'cancelado' } : fila))
      setAviso(`Pedido ${pedido.numero} cancelado`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function eliminar(pedido: PedidoResumen) {
    setError(null)
    if (await eliminarConConfirmacion(token, `/pedidos/${pedido.id}`, `¿Eliminar ${pedido.numero}? Esta acción no se puede deshacer.`, setError)) {
      setPedidos((filas) => filas.filter((fila) => fila.id !== pedido.id))
      setAviso(`Pedido ${pedido.numero} eliminado`)
    }
  }

  const q = busqueda.trim().toLowerCase()
  const visibles = q ? pedidos.filter((p) => `${p.numero} ${p.cliente}`.toLowerCase().includes(q)) : pedidos

  return (
    <section className="pantalla">
      <Encabezado titulo="Pedidos">
        <MenuPedidos />
      </Encabezado>
      <section className="tarjeta" aria-label="Lista de pedidos">
        <div className="encabezado-tabla">
          <label className="filtro-estado">
            <span className="solo-lectores">Estado</span>
            <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedido | '')}>
              <option value="">Todos los estados</option>
              {(['creado', 'en_preparacion', 'despachado', 'entregado', 'cancelado'] as const).map((e) => <option key={e} value={e}>{etiquetaEstadoPedido(e)}</option>)}
            </select>
          </label>
          <BuscadorTabla valor={busqueda} onCambio={setBusqueda} placeholder="Número o cliente (esta página)" />
        </div>
        {error && <AvisoApi error={error} />}
        {aviso && <p className="nota-ok" role="status">{aviso}</p>}
        {visibles.length === 0 && !error && <p className="nota">No hay pedidos en esta página.</p>}
        {visibles.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th className="num">Total</th><th>Fecha</th><th /></tr></thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td className="sku"><Link to={`/pedidos/${p.id}`}>{p.numero}</Link></td>
                    <td>{p.cliente}</td>
                    <td><span className={clasePedido(p.estado)}>{etiquetaEstadoPedido(p.estado)}</span></td>
                    <td className="num">{quetzales(Number(p.total))}</td>
                    <td>{new Date(p.created_at).toLocaleDateString('es-GT')}</td>
                    <td className="acciones-fila">
                      {usuario && puedeCancelarPedido(usuario.rol, p.estado) && (
                        <button type="button" aria-label={`Cancelar ${p.numero}`} onClick={() => void cancelar(p)}>Cancelar</button>
                      )}
                      {p.estado === 'cancelado' && (
                        <button type="button" className="boton-peligro" aria-label={`Eliminar ${p.numero}`} onClick={() => void eliminar(p)}>Eliminar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="paginador" aria-label="Paginación">
          <span>Página {pagina}</span>
          <div>
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <button type="button" disabled={pedidos.length < POR_PAGINA} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        </nav>
        <p className="nota">Solo se eliminan pedidos cancelados: cancelar primero devuelve el stock reservado al disponible.</p>
      </section>
    </section>
  )
}
