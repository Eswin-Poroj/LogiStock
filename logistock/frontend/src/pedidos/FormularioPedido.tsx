import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MenuPedidos } from './MenuPedidos'
import { useConfiguracion } from '../comun/useConfiguracion'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { Bodega, Cliente, Cotizacion, CotizacionResumen, InventarioRespuesta, Pedido, PedidoNuevo, Producto, Sustituto } from '../dominio/tipos'
import { FormularioCliente } from '../catalogo/FormularioCliente'
import { esUuid } from '../dominio/uuid'
import { Encabezado } from '../navegacion/Encabezado'
import {
  IVA_PORCENTAJE,
  ajustarADisponible,
  dejarBackorder,
  lineaReservable,
  pedidoValido,
  politicaDelFormulario,
  requiereAutorizacion,
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
  const { token, usuario } = useSesion()
  const config = useConfiguracion(token)
  const [descuentoTexto, setDescuentoTexto] = useState('0')
  const [supervisorCorreo, setSupervisorCorreo] = useState('')
  const [supervisorClave, setSupervisorClave] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cotizacionDeEnlace = params.get('cotizacion')
  const clientes = useListado<Cliente>('/clientes?limite=500', token)
  const [clientesNuevos, setClientesNuevos] = useState<Cliente[]>([])
  const [altaCliente, setAltaCliente] = useState(false)
  const [sustitutos, setSustitutos] = useState<Sustituto[] | null>(null)
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([])
  const [cotizacionId, setCotizacionId] = useState<string | null>(null)
  const bodegas = useListado<Bodega>('/bodegas', token)
  const catalogo = useListado<Producto>('/productos?limite=500', token)
  const [filtroCatalogo, setFiltroCatalogo] = useState('')
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

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<CotizacionResumen[]>('/cotizaciones', { token })
      .then((filas) => { if (vivo) setCotizaciones(filas.filter((fila) => !fila.pedido_id)) })
      .catch(() => { /* sin cotizaciones guardadas: el selector queda vacío */ })
    return () => { vivo = false }
  }, [token])

  // Desde Cotizaciones › Abrir llega ?cotizacion=<id>: se carga una sola vez.
  const [enlaceCargado, setEnlaceCargado] = useState(false)
  useEffect(() => {
    if (!token || !cotizacionDeEnlace || enlaceCargado) return
    setEnlaceCargado(true)
    void abrirCotizacion(cotizacionDeEnlace)
  })

  const listaClientes = [...clientesNuevos, ...clientes.items.filter((fila) => !clientesNuevos.some((nuevo) => nuevo.id === fila.id))]
  const cliente = listaClientes.find((fila) => fila.id === clienteId)
  const bodega = bodegas.items.find((fila) => fila.id === bodegaId)
  const descuentoPct = Number(descuentoTexto)
  const descuentoOk = descuentoTexto.trim() !== '' && Number.isFinite(descuentoPct) && descuentoPct >= 0 && descuentoPct <= 100
  const resumen = resumenPedido(lineas, descuentoOk ? descuentoPct : 0)
  const pideSupervisor = descuentoOk && requiereAutorizacion(descuentoPct, config.descuento_max_pct, usuario?.rol ?? '')
  const supervisorOk = !pideSupervisor || (supervisorCorreo.includes('@') && supervisorClave.length > 0)
  const valido = pedidoValido({ cliente_id: clienteId, bodega_id: bodegaId, lineas }) && descuentoOk && supervisorOk
  const errorLista = clientes.error ?? bodegas.error ?? catalogo.error
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
      await agregarProducto(producto)
      setCoincidencias([])
      setProductoElegido('')
      setBusqueda('')
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  /** Suma una unidad del producto; el disponible se relee de la API para no cotizar con datos viejos. */
  async function agregarProducto(producto: Producto) {
    if (!token || !esUuid(bodegaId)) return
    setError(null)
    try {
      const inventario = await api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
      setExistencias(inventario.items)
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
    if (cotizacionId) body.cotizacion_id = cotizacionId
    if (descuentoPct > 0) body.descuento_pct = descuentoPct
    if (pideSupervisor) body.autorizacion = { correo: supervisorCorreo.trim(), clave: supervisorClave }
    try {
      const creado = await api<Pedido>('/pedidos', { method: 'POST', token, body })
      navigate(`/pedidos/${creado.id}`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  /** CU-01 E1: sustitutos de la misma categoría con stock suficiente en la bodega. */
  async function verSustitutos(linea: LineaCotizacion) {
    if (!token || !esUuid(bodegaId)) return
    setSustitutosDe(linea.producto_id)
    setSustitutos(null)
    try {
      setSustitutos(await api<Sustituto[]>(`/productos/${linea.producto_id}/sustitutos?bodega_id=${bodegaId}&cantidad=${linea.cantidad}`, { token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  function usarSustituto(original: string, sustituto: Sustituto) {
    setLineas((actuales) => {
      const cantidad = actuales.find((fila) => fila.producto_id === original)?.cantidad ?? 1
      const sinOriginal = actuales.filter((fila) => fila.producto_id !== original && fila.producto_id !== sustituto.producto_id)
      return [...sinOriginal, {
        producto_id: sustituto.producto_id, sku: sustituto.sku, nombre: sustituto.nombre, cantidad,
        disponible: sustituto.disponible, precio_unitario: sustituto.precio_unitario, resolucion: 'pendiente',
      }]
    })
    setSustitutosDe(null)
    setSustitutos(null)
  }

  async function guardarCotizacion() {
    if (!token || !esUuid(clienteId) || !esUuid(bodegaId) || lineas.length === 0) return
    setError(null)
    setAvisoCotizacion(null)
    try {
      const guardada = await api<Cotizacion>('/cotizaciones', {
        method: 'POST',
        token,
        body: { cliente_id: clienteId, bodega_id: bodegaId, lineas: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad })) },
      })
      setCotizacionId(guardada.id)
      setCotizaciones((actuales) => [{ id: guardada.id, numero: guardada.numero, cliente: guardada.cliente, total: guardada.total, created_at: guardada.created_at, pedido_id: null }, ...actuales.filter((c) => c.id !== guardada.id)])
      setAvisoCotizacion(`Cotización ${guardada.numero} guardada por ${quetzales(guardada.total)}. No reserva stock hasta confirmar el pedido.`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function abrirCotizacion(id: string) {
    if (!token || !id) return
    setError(null)
    try {
      const c = await api<Cotizacion>(`/cotizaciones/${id}`, { token })
      setClienteId(c.cliente_id)
      setBodegaId(c.bodega_id)
      setCotizacionId(c.id)
      setLineas(c.lineas.map((l) => ({
        producto_id: l.producto_id, sku: l.sku, nombre: l.nombre, cantidad: l.cantidad,
        disponible: existencias.find((fila) => fila.producto_id === l.producto_id)?.disponible ?? null,
        precio_unitario: l.precio_unitario, resolucion: 'pendiente',
      })))
      setAvisoCotizacion(`Cotización ${c.numero} cargada. Confirma el pedido para reservar el stock.`)
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
    setSustitutos(null)
    setCotizacionId(null)
    setDescuentoTexto('0')
    setSupervisorCorreo('')
    setSupervisorClave('')
  }

  return (
    <section className="panel panel-pedido">
      <Encabezado titulo="Nuevo pedido de venta">
        <MenuPedidos />
        {cotizaciones.length > 0 && (
          <select aria-label="Abrir cotización" value="" onChange={(evento) => void abrirCotizacion(evento.target.value)}>
            <option value="">Abrir cotización…</option>
            {cotizaciones.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.cliente} · {quetzales(c.total)}</option>)}
          </select>
        )}
        <button type="button" onClick={cancelarBorrador}>Cancelar</button>
      </Encabezado>
      {errorLista && <AvisoApi error={errorLista} />}
      {errorConfirmacion && !stock409 && <AvisoApi error={errorConfirmacion} />}
      {stock409 && errorConfirmacion && (
        <p role="alert" className="aviso-api aviso-api--error">{avisoStock409(errorConfirmacion)}</p>
      )}
      <form className="formulario-pedido" onSubmit={(evento) => evento.preventDefault()}>
        <div className="pedido-cuerpo">
          <div className="pedido-principal">
            <section className="tarjeta" aria-labelledby="titulo-cliente">
              <h2 id="titulo-cliente">Cliente y bodega</h2>
              <div className="pedido-datos">
                <label>
                  Cliente
                  <select value={clienteId} onChange={(evento) => setClienteId(evento.target.value)}>
                    <option value="">Selecciona</option>
                    {listaClientes.map((fila) => <option key={fila.id} value={fila.id}>{fila.nombre}</option>)}
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
              </div>
              <button type="button" className="enlace-accion" aria-expanded={altaCliente} onClick={() => setAltaCliente((abierto) => !abierto)}>
                {altaCliente ? 'Cerrar alta de cliente' : '¿El cliente no existe? Registrarlo'}
              </button>
              {altaCliente && (
                <FormularioCliente onCreado={(nuevo) => {
                  setClientesNuevos((actuales) => [nuevo, ...actuales])
                  setClienteId(nuevo.id)
                  setAltaCliente(false)
                }} />
              )}
            </section>
            <section className="tarjeta" aria-labelledby="titulo-lineas">
              <div className="tarjeta-titulo">
                <h2 id="titulo-lineas">Líneas del pedido</h2>
                {bodega && <p>Stock validado en línea contra {bodega.nombre}</p>}
              </div>
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th className="num">Disponible</th>
                      <th className="num">Precio unit.</th>
                      <th className="num">Subtotal</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((linea) => {
                      const reservable = lineaReservable(linea)
                      const subtotal = reservable ? linea.cantidad * linea.precio_unitario : 0
                      return (
                        <tr key={linea.producto_id} className={reservable ? undefined : 'fila-alerta'}>
                          <td><span className="producto-nombre">{linea.nombre}</span><span className="sku">{linea.sku}</span></td>
                          <td>
                            <input
                              aria-label={`Cantidad ${linea.sku}`}
                              type="number"
                              min={1}
                              value={linea.cantidad}
                              onChange={(evento) => cambiarCantidad(linea.producto_id, Number(evento.target.value))}
                            />
                          </td>
                          <td className="num">{linea.disponible ?? ''}</td>
                          <td className="num">{quetzales(linea.precio_unitario)}</td>
                          <td className="num">{reservable ? quetzales(subtotal) : <span className="no-incluido">No incluido</span>}</td>
                          <td className={reservable ? 'estado-ok' : 'estado-alerta'}>
                            <span className="pastilla">
                              {reservable && 'Reservable'}
                              {!reservable && linea.resolucion === 'backorder' && 'Backorder'}
                              {!reservable && linea.resolucion !== 'backorder' && 'Stock insuficiente'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {lineas.filter((linea) => !lineaReservable(linea)).map((linea) => (
                <div key={linea.producto_id} className="aviso-faltante" role="status">
                  <p>{`${linea.sku}: solo hay ${linea.disponible ?? ''} de ${linea.cantidad} unidades en ${bodega?.nombre ?? 'la bodega'}`}</p>
                  <p className="detalle">Esta línea se rechaza sin bloquear el resto del pedido. Ajusta la cantidad, elige un sustituto o déjala como backorder.</p>
                  <div className="acciones-faltante">
                    <button
                      type="button"
                      disabled={linea.disponible === null || linea.disponible < 1}
                      onClick={() => setLineas((actuales) => actuales.map((fila) => fila.producto_id === linea.producto_id ? ajustarADisponible(fila) : fila))}
                    >
                      Ajustar a {linea.disponible}
                    </button>
                    <button type="button" onClick={() => void verSustitutos(linea)}>Ver sustitutos</button>
                    <button
                      type="button"
                      aria-pressed={linea.resolucion === 'backorder'}
                      onClick={() => setLineas((actuales) => actuales.map((fila) => fila.producto_id === linea.producto_id ? dejarBackorder(fila) : fila))}
                    >
                      Dejar como backorder
                    </button>
                  </div>
                  {sustitutosDe === linea.producto_id && sustitutos && (
                    <>
                      {sustitutos.length === 0 && <p>No hay sustitutos de la misma categoría con {linea.cantidad} unidades disponibles.</p>}
                      <ul className="lista-sustitutos" data-testid={`sustitutos-${linea.producto_id}`}>
                        {sustitutos.map((s) => (
                          <li key={s.producto_id}>
                            <span><strong>{s.sku}</strong> {s.nombre} · disponible {s.disponible} · {quetzales(s.precio_unitario)}</span>
                            <button type="button" onClick={() => usarSustituto(linea.producto_id, s)}>Usar {s.sku}</button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))}
              <div className="pedido-busqueda">
                <label>
                  Agregar producto
                  <input aria-label="Buscar por SKU o nombre" placeholder="Buscar por SKU o nombre" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
                </label>
                <button type="button" disabled={busqueda.trim() === '' || !esUuid(bodegaId)} onClick={() => void agregar()}>Agregar línea</button>
              </div>
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
            </section>
            <section className="tarjeta" aria-label="Productos disponibles">
              <div className="tarjeta-titulo">
                <h2>Productos</h2>
                <input aria-label="Filtrar productos" placeholder="Filtrar por SKU o nombre" value={filtroCatalogo} onChange={(evento) => setFiltroCatalogo(evento.target.value)} />
              </div>
              {catalogo.items.length === 0 && !catalogo.error && <p className="nota">Aún no hay productos en el catálogo.</p>}
              {!bodega && catalogo.items.length > 0 && <p className="nota">Elige la bodega de despacho para ver el disponible y agregar productos.</p>}
              {catalogo.items.length > 0 && (
                <div className="tabla-contenedor tabla-catalogo-pedido">
                  <table>
                    <thead><tr><th>SKU</th><th>Producto</th><th className="num">Disponible</th><th className="num">Precio</th><th /></tr></thead>
                    <tbody>
                      {catalogo.items
                        .filter((producto) => `${producto.sku} ${producto.nombre}`.toLowerCase().includes(filtroCatalogo.trim().toLowerCase()))
                        .map((producto) => {
                          const disponible = existencias.find((fila) => fila.producto_id === producto.id)?.disponible ?? 0
                          const enPedido = lineas.some((linea) => linea.producto_id === producto.id)
                          return (
                            <tr key={producto.id} className={enPedido ? 'fila-activa' : undefined}>
                              <td className="sku">{producto.sku}</td>
                              <td>{producto.nombre}</td>
                              <td className="num">{bodega ? disponible : '—'}</td>
                              <td className="num">{quetzales(Number(producto.precio_unitario))}</td>
                              <td className="acciones-fila">
                                <button type="button" aria-label={`Agregar ${producto.sku}`} disabled={!bodega} onClick={() => void agregarProducto(producto)}>
                                  {enPedido ? '+1' : 'Agregar'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          <div className="pedido-lateral">
            <aside className="tarjeta resumen-caja">
              <h2>Resumen</h2>
              <p>Líneas confirmadas <span>{resumen.confirmadas} de {resumen.totalLineas}</span></p>
              <p>Subtotal <span>{quetzales(resumen.subtotal)}</span></p>
              <label className="campo-descuento">
                Descuento %
                <input type="number" min={0} max={100} step="0.5" value={descuentoTexto} onChange={(evento) => setDescuentoTexto(evento.target.value)} />
              </label>
              {resumen.descuento > 0 && <p>Descuento {descuentoPct} % <span>-{quetzales(resumen.descuento)}</span></p>}
              <p>IVA {IVA_PORCENTAJE} % <span>{quetzales(resumen.iva)}</span></p>
              <p className="resumen-total">Total <span>{quetzales(resumen.total)}</span></p>
              {pideSupervisor && (
                <fieldset className="autorizacion-supervisor">
                  <legend>Autorización de supervisor</legend>
                  <p className="nota">El descuento supera el máximo de {config.descuento_max_pct} %. Un administrador debe autorizarlo con su cuenta.</p>
                  <label>Correo del supervisor<input type="email" autoComplete="off" value={supervisorCorreo} onChange={(e) => setSupervisorCorreo(e.target.value)} /></label>
                  <label>Contraseña del supervisor<input type="password" autoComplete="new-password" value={supervisorClave} onChange={(e) => setSupervisorClave(e.target.value)} /></label>
                </fieldset>
              )}
              <button type="button" className="boton-primario" disabled={!valido} onClick={() => void confirmar()}>Confirmar pedido</button>
              <button type="button" disabled={!esUuid(clienteId) || !esUuid(bodegaId) || lineas.length === 0} onClick={() => void guardarCotizacion()}>Guardar como cotización</button>
              {avisoCotizacion && <p role="status">{avisoCotizacion}</p>}
              <p className="nota-resumen">Las líneas sin stock no se incluyen en el total ni se reservan.</p>
            </aside>
            <section className="tarjeta-info pedido-pasos">
              <h2>Qué pasa al confirmar</h2>
              <ol>
                <li>Se bloquea cada SKU por bodega para evitar que otro asesor reserve el mismo stock.</li>
                <li>El stock de cada línea pasa de Disponible a Reservado.</li>
                <li>Se crea el pedido en estado Creado y se encola en picking.</li>
              </ol>
            </section>
          </div>
        </div>
      </form>
    </section>
  )
}
