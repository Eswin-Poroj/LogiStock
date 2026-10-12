import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, Cliente, InventarioRespuesta, Pedido, PedidoNuevo, PoliticaFaltantes, Producto } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { lineaSinStock, pedidoValido } from './pedidoValido'

export function FormularioPedido() {
  const { token } = useSesion()
  const clientes = useListado<Cliente>('/clientes', token)
  const productos = useListado<Producto>('/productos', token)
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [clienteId, setClienteId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [politica, setPolitica] = useState<PoliticaFaltantes>('rechazar')
  const [disponible, setDisponible] = useState<number | null>(null)
  const [opcion, setOpcion] = useState<'ajustar' | 'sustitutos' | 'backorder' | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [pedido, setPedido] = useState<Pedido | null>(null)

  useEffect(() => {
    if (!token || !esUuid(bodegaId) || !esUuid(productoId)) {
      setDisponible(null)
      return
    }
    let vivo = true
    api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
      .then((respuesta) => {
        if (!vivo) return
        const item = respuesta.items.find((fila) => fila.producto_id === productoId)
        setDisponible(item ? item.disponible : 0)
      })
      .catch((fallo: unknown) => {
        if (!vivo) return
        setDisponible(null)
        if (fallo instanceof ApiError) setError(fallo)
      })
    return () => {
      vivo = false
    }
  }, [token, bodegaId, productoId])

  const formulario = {
    cliente_id: clienteId,
    bodega_id: bodegaId,
    politica_faltantes: politica,
    lineas: [{ producto_id: productoId, cantidad, disponible }],
  }
  const valido = pedidoValido(formulario)
  const sinStock = disponible !== null && lineaSinStock(disponible, cantidad)
  const errorLista = clientes.error ?? productos.error ?? bodegas.error

  async function confirmar() {
    if (!token || !valido) return
    setError(null)
    const body: PedidoNuevo = {
      cliente_id: clienteId,
      bodega_id: bodegaId,
      politica_faltantes: politica,
      lineas: [{ producto_id: productoId, cantidad }],
    }
    try {
      setPedido(await api<Pedido>('/pedidos', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <h1>Nuevo pedido</h1>
      {(errorLista || error) && <AvisoApi error={(errorLista ?? error) as ApiError} />}
      <label>
        Cliente
        <select value={clienteId} onChange={(evento) => setClienteId(evento.target.value)}>
          <option value="">Selecciona</option>
          {clientes.items.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
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
      {sinStock && (
        <div role="status">
          <p>Esta línea no tiene stock suficiente. Disponible: {disponible}. Solicitado: {cantidad}.</p>
          <button type="button" onClick={() => setOpcion('ajustar')}>Ajustar</button>
          <button type="button" onClick={() => setOpcion('sustitutos')}>Ver sustitutos</button>
          <button type="button" aria-pressed={politica === 'backorder'} onClick={() => { setPolitica('backorder'); setOpcion('backorder') }}>Backorder</button>
          {opcion === 'ajustar' && <p>No se envió un ajuste. Un ajuste positivo responde 501 y esta pantalla no inventa existencias.</p>}
          {opcion === 'sustitutos' && (
            <>
              <p>La API no tiene sustitutos. No se muestra ningún producto de reemplazo.</p>
              <ul data-testid="sustitutos" />
            </>
          )}
          {opcion === 'backorder' && <p>Las líneas sin stock quedan en backorder.</p>}
        </div>
      )}
      {error?.lineasSinStock?.map((linea) => (
        <p key={linea.producto_id}>{linea.sku}: solicitado {linea.solicitado}, disponible {linea.disponible}</p>
      ))}
      <button type="button" disabled={!valido} onClick={() => void confirmar()}>Confirmar pedido</button>
      {pedido && <p>Pedido {pedido.numero}</p>}
    </section>
  )
}
