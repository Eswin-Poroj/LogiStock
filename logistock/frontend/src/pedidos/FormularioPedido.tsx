import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { Bodega, Cliente, InventarioRespuesta, Pedido, PedidoNuevo, Producto } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import {
  IVA_PORCENTAJE,
  ajustarADisponible,
  dejarBackorder,
  lineaReservable,
  pedidoValido,
  politicaDelFormulario,
  resumenPedido,
} from './pedidoValido'
import type { LineaCotizacion } from './pedidoValido'

function avisoStock409(error: ApiError): string {
  const lineas = error.lineasSinStock ?? []
  if (lineas.length === 0) return `El servicio respondió ${error.status}: ${error.message}`
  const detalle = lineas.map((l) => `${l.sku}: solicitado ${l.solicitado}, disponible ${l.disponible}`).join('; ')
  return `No se pudo reservar el stock (${detalle}).`
}

export function FormularioPedido() {
  const { token } = useSesion()
  const navigate = useNavigate()
  const clientes = useListado<Cliente>('/clientes', token)
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [clienteId, setClienteId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [coincidencias, setCoincidencias] = useState<Producto[]>([])
  const [productoElegido, setProductoElegido] = useState('')
  const [avisoBusqueda, setAvisoBusqueda] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaCotizacion[]>([])
  const [sustitutosDe, setSustitutosDe] = useState<string | null>(null)
  const [avisoCotizacion, setAvisoCotizacion] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [existencias, setExistencias] = useState<InventarioRespuesta['items']>([])

  useEffect(() => {
    if (!token || !esUuid(bodegaId)) {
      setExistencias([])
      return
    }
    let vivo = true
    api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
      .then((respuesta) => { if (vivo) setExistencias(respuesta.items) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, bodegaId])

  useEffect(() => {
    setLineas((actuales) => actuales.map((linea) => {
      const item = existencias.find((fila) => fila.producto_id === linea.producto_id)
      if (!item) return linea
      return { ...linea, disponible: item.disponible }
    }))
  }, [existencias])

  const cliente = clientes.items.find((fila) => fila.id === clienteId)
  const bodega = bodegas.items.find((fila) => fila.id === bodegaId)
  const resumen = resumenPedido(lineas)
  const valido = pedidoValido({ cliente_id: clienteId, bodega_id: bodegaId, lineas })
  const errorLista = clientes.error ?? bodegas.error
  const errorConfirmacion = errorLista ? null : error
  const stock409 = errorConfirmacion?.status === 409 && (errorConfirmacion.lineasSinStock?.length ?? 0) > 0

  async function agregar() {
    const q = busqueda.trim()
    if (!token || q === '' || !esUuid(bodegaId)) return
    setAvisoBusqueda(null)
    setError(null)
    try {
      const encontrados = await api<Producto[]>(`/productos?q=${encodeURIComponent(q)}`, { token })
      if (encontrados.length === 0) {
        setCoincidencias([])
        setAvisoBusqueda('Ningún producto coincide.')
        return
      }
      if (encontrados.length > 1 && !encontrados.some((fila) => fila.id === productoElegido)) {
        setCoincidencias(encontrados)
        setAvisoBusqueda('Hay varios productos. Elige uno y vuelve a agregar.')
        return
      }
      const producto = encontrados.length === 1 ? encontrados[0] : encontrados.find((fila) => fila.id === productoElegido)!
      const inventario = await api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
      const item = inventario.items.find((fila) => fila.producto_id === producto.id)
      const disponible = item ? item.disponible : 0
      setLineas((actuales) => {
        const ya = actuales.find((fila) => fila.producto_id === producto.id)
        if (ya) {
          return actuales.map((fila) => fila.producto_id === producto.id
            ? { ...fila, cantidad: fila.cantidad + 1, disponible, resolucion: 'pendiente' }
            : fila)
        }
        const nueva: LineaCotizacion = {
          producto_id: producto.id,
          sku: producto.sku,
          nombre: producto.nombre,
          cantidad: 1,
          disponible,
          precio_unitario: producto.precio_unitario,
          resolucion: 'pendiente',
        }
        return [...actuales, nueva]
      })
      setCoincidencias([])
      setProductoElegido('')
      setBusqueda('')
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setLineas((actuales) => actuales.map((fila) => fila.producto_id === productoId
      ? { ...fila, cantidad, resolucion: 'pendiente' }
      : fila))
  }

  async function confirmar() {
    if (!token || !valido) return
    setError(null)
    const body: PedidoNuevo = {
      cliente_id: clienteId,
      bodega_id: bodegaId,
      politica_faltantes: politicaDelFormulario(lineas),
      lineas: lineas.map((linea) => ({ producto_id: linea.producto_id, cantidad: linea.cantidad })),
    }
    try {
      const creado = await api<Pedido>('/pedidos', { method: 'POST', token, body })
      navigate(`/pedidos/${creado.id}`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  function cancelarBorrador() {
    setClienteId('')
    setBodegaId('')
    setLineas([])
    setBusqueda('')
    setCoincidencias([])
    setAvisoBusqueda(null)
    setAvisoCotizacion(null)
    setError(null)
    setSustitutosDe(null)
  }

  return (
    <section className="panel panel-pedido">
      <header className="panel-encabezado">
        <h1>Nuevo pedido de venta</h1>
        <button type="button" onClick={cancelarBorrador}>Cancelar</button>
        <p className="panel-subtitulo">Cotización con validación de stock en la bodega seleccionada (CU-01 / CU-02).</p>
      </header>
      {errorLista && <AvisoApi error={errorLista} />}
      {errorConfirmacion && !stock409 && <AvisoApi error={errorConfirmacion} />}
      {stock409 && errorConfirmacion && (
        <p role="alert" className="aviso-api aviso-api--error">{avisoStock409(errorConfirmacion)}</p>
      )}
      <form className="formulario-pedido" onSubmit={(evento) => evento.preventDefault()}>
        <label>
          Cliente
          <select value={clienteId} onChange={(evento) => setClienteId(evento.target.value)}>
            <option value="">Selecciona</option>
            {clientes.items.map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
          </select>
        </label>
        <label>
          NIT
          <input aria-label="NIT" value={cliente?.nit ?? ''} disabled readOnly />
        </label>
        <label>
          Bodega de despacho
          <select value={bodegaId} onChange={(evento) => setBodegaId(evento.target.value)}>
            <option value="">Selecciona</option>
            {bodegas.items.map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
          </select>
        </label>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Disponible</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => {
              const reservable = lineaReservable(linea)
              const subtotal = reservable ? linea.cantidad * linea.precio_unitario : 0
              return (
                <tr key={linea.producto_id}>
                  <td>{linea.nombre}<br />{linea.sku}</td>
                  <td>
                    <input
                      aria-label={`Cantidad ${linea.sku}`}
                      type="number"
                      min={1}
                      value={linea.cantidad}
                      onChange={(evento) => cambiarCantidad(linea.producto_id, Number(evento.target.value))}
                    />
                  </td>
                  <td>{linea.disponible ?? ''}</td>
                  <td>{quetzales(linea.precio_unitario)}</td>
                  <td>{quetzales(subtotal)}</td>
                  <td>
                    {reservable && 'Reservable'}
                    {!reservable && linea.resolucion === 'backorder' && 'Backorder'}
                    {!reservable && linea.resolucion !== 'backorder' && 'Stock insuficiente'}
                    {!reservable && <><br />No incluido</>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {lineas.filter((linea) => !lineaReservable(linea)).map((linea) => (
          <div key={linea.producto_id} className="aviso-faltante" role="status">
            <p>{`${linea.sku}: solo hay ${linea.disponible ?? ''} de ${linea.cantidad} unidades en ${bodega?.nombre ?? 'la bodega'}`}</p>
            <div className="acciones-faltante">
              <button
                type="button"
                disabled={linea.disponible === null || linea.disponible < 1}
                onClick={() => setLineas((actuales) => actuales.map((fila) => fila.producto_id === linea.producto_id ? ajustarADisponible(fila) : fila))}
              >
                Ajustar a {linea.disponible}
              </button>
              <button type="button" onClick={() => setSustitutosDe(linea.producto_id)}>Ver sustitutos</button>
              <button
                type="button"
                aria-pressed={linea.resolucion === 'backorder'}
                onClick={() => setLineas((actuales) => actuales.map((fila) => fila.producto_id === linea.producto_id ? dejarBackorder(fila) : fila))}
              >
                Dejar como backorder
              </button>
            </div>
            {sustitutosDe === linea.producto_id && (
              <>
                <p>La API no tiene sustitutos. No se muestra ningún producto de reemplazo.</p>
                <ul data-testid={`sustitutos-${linea.producto_id}`} />
              </>
            )}
          </div>
        ))}
        <label>
          Buscar por SKU o nombre
          <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
        </label>
        {coincidencias.length > 1 && (
          <label>
            Coincidencias
            <select aria-label="Coincidencias" value={productoElegido} onChange={(evento) => setProductoElegido(evento.target.value)}>
              <option value="">Selecciona</option>
              {coincidencias.map((fila) => <option key={fila.id} value={fila.id}>{fila.sku} {fila.nombre}</option>)}
            </select>
          </label>
        )}
        {avisoBusqueda && <p role="status">{avisoBusqueda}</p>}
        <button type="button" disabled={busqueda.trim() === '' || !esUuid(bodegaId)} onClick={() => void agregar()}>Agregar línea</button>
        <aside>
          <h2>Resumen</h2>
          <p>Líneas confirmadas <span>{resumen.confirmadas} de {resumen.totalLineas}</span></p>
          <p>Subtotal <span>{quetzales(resumen.subtotal)}</span></p>
          <p>IVA {IVA_PORCENTAJE} % <span>{quetzales(resumen.iva)}</span></p>
          <p>Total <span>{quetzales(resumen.total)}</span></p>
          <button type="button" className="boton-primario" disabled={!valido} onClick={() => void confirmar()}>Confirmar pedido</button>
          <button type="button" onClick={() => setAvisoCotizacion('La API no guarda cotizaciones. Confirma el pedido para reservar el stock.')}>Guardar como cotización</button>
          {avisoCotizacion && <p role="status">{avisoCotizacion}</p>}
          <p>Las líneas sin stock no se incluyen en el total ni se reservan.</p>
        </aside>
        <section>
          <h2>Qué pasa al confirmar</h2>
          <ol>
            <li>Se bloquea cada SKU por bodega para evitar que otro asesor reserve el mismo stock.</li>
            <li>El stock de cada línea pasa de Disponible a Reservado.</li>
            <li>Se crea el pedido en estado Creado y se encola en picking.</li>
          </ol>
        </section>
      </form>
    </section>
  )
}
