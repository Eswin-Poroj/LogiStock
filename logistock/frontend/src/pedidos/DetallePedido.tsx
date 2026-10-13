import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { Pedido } from '../dominio/tipos'
import { etiquetaEstadoPedido, notaEstadoPedido, puedeCancelarPedido } from './estadosPedido'

export function DetallePedido() {
  const { id } = useParams()
  const { token, usuario } = useSesion()
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

  if (!pedido) return error ? <AvisoApi error={error} /> : null

  return (
    <section>
      <h1>Pedido {pedido.numero}</h1>
      <p>{pedido.cliente}</p>
      <p>{etiquetaEstadoPedido(pedido.estado)}</p>
      <p>{notaEstadoPedido(pedido.estado)}</p>
      {error && <AvisoApi error={error} />}
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
      <p>Subtotal {quetzales(pedido.subtotal)}</p>
      <p>IVA {quetzales(pedido.iva)}</p>
      <p>Total {quetzales(pedido.total)}</p>
      {usuario && puedeCancelarPedido(usuario.rol, pedido.estado) && (
        <button type="button" onClick={() => void cancelar()}>Cancelar pedido</button>
      )}
    </section>
  )
}
