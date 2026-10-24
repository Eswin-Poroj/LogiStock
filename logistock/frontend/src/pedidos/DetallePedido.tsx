import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { eliminarConConfirmacion } from '../comun/paginar'
import { MenuPedidos } from './MenuPedidos'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { Pedido } from '../dominio/tipos'
import { etiquetaEstadoPedido, notaEstadoPedido, puedeCancelarPedido } from './estadosPedido'
import { Encabezado } from '../navegacion/Encabezado'

export function DetallePedido() {
  const { id } = useParams()
  const { token, usuario } = useSesion()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!token || !id) return
    let vivo = true
    api<Pedido>(`/pedidos/${id}`, { token })
      .then((respuesta) => { if (vivo) setPedido(respuesta) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, id])

  async function cancelar() {
    if (!token || !id) return
    setError(null)
    try {
      setPedido(await api<Pedido>(`/pedidos/${id}/cancelar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function eliminar() {
    if (!pedido) return
    if (await eliminarConConfirmacion(token, `/pedidos/${pedido.id}`, `¿Eliminar ${pedido.numero}? Esta acción no se puede deshacer.`, setError)) {
      navigate('/pedidos/lista')
    }
  }

  if (!pedido) return error ? <AvisoApi error={error} /> : null

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo={`Pedido ${pedido.numero}`}>
        <MenuPedidos />
      </Encabezado>
      <div className="ficha">
        <p>{pedido.cliente}</p>
        <p className="estado-pedido">{etiquetaEstadoPedido(pedido.estado)}</p>
        <p>{notaEstadoPedido(pedido.estado)}</p>
        {pedido.estado_picking === 'con_faltante' && (
          <p className="aviso-api aviso-api--error" role="status">El picking quedó con faltante. Ofrece al cliente un sustituto o dejar la diferencia en backorder.</p>
        )}
        {error && <AvisoApi error={error} />}
        <div className="tabla-contenedor">
          <table>
            <tbody>
              {pedido.lineas.map((linea) => (
                <tr key={linea.id}>
                  <td>{linea.sku}</td>
                  <td>{linea.nombre}</td>
                  <td>{linea.cantidad}</td>
                  <td>{linea.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="resumen-caja">
          <p>Subtotal {quetzales(pedido.subtotal)}</p>
          {Number(pedido.descuento ?? 0) > 0 && (
            <p>Descuento {pedido.descuento_pct} % -{quetzales(Number(pedido.descuento))}{pedido.autorizado_por ? ` · autorizó ${pedido.autorizado_por}` : ''}</p>
          )}
          <p>IVA {quetzales(pedido.iva)}</p>
          <p>Total {quetzales(pedido.total)}</p>
          {usuario && puedeCancelarPedido(usuario.rol, pedido.estado) && (
            <button type="button" className="boton-alerta" onClick={() => void cancelar()}>Cancelar pedido</button>
          )}
          {pedido.estado === 'cancelado' && (
            <button type="button" className="boton-peligro" onClick={() => void eliminar()}>Eliminar pedido</button>
          )}
        </aside>
      </div>
    </section>
  )
}
