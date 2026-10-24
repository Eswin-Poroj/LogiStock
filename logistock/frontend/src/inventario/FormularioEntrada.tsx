import { useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, EntradaNueva, Existencia, InventarioRespuesta, Producto, Proveedor, Recepcion } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'
import { Encabezado } from '../navegacion/Encabezado'

interface LineaEntrada { producto_id: string; cantidad: number }

/** CU-03: una recepción con una línea por producto recibido. */
export function FormularioEntrada() {
  const { token, usuario } = useSesion()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const productos = useListado<Producto>('/productos?limite=500', token)
  const proveedores = useListado<Proveedor>('/proveedores', token)
  const [proveedorId, setProveedorId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [lineas, setLineas] = useState<LineaEntrada[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [recepcion, setRecepcion] = useState<Recepcion | null>(null)
  const [existencias, setExistencias] = useState<Existencia[]>([])
  const listaError = bodegas.error ?? productos.error ?? proveedores.error
  const lineaValida = esUuid(productoId) && Number.isInteger(cantidad) && cantidad >= 1
  // Si la línea en edición es válida y aún no se agregó, también cuenta al registrar.
  const porEnviar = lineaValida ? sumar(lineas, { producto_id: productoId, cantidad }) : lineas
  const listo = esUuid(proveedorId) && esUuid(bodegaId) && porEnviar.length > 0

  if (!usuario || accesoDe(usuario.rol, 'inventario') !== 'escritura') {
    return <p role="alert">Inventario es de solo lectura para tu rol.</p>
  }

  function agregar() {
    if (!lineaValida) return
    setLineas(porEnviar)
    setProductoId('')
    setCantidad(1)
  }

  async function enviar() {
    if (!token || !listo) return
    setError(null)
    const body: EntradaNueva = { proveedor_id: proveedorId, bodega_id: bodegaId, lineas: porEnviar }
    try {
      const creada = await api<Recepcion>('/inventario/entradas', { method: 'POST', token, body })
      setRecepcion(creada)
      const ids = new Set(porEnviar.map((linea) => linea.producto_id))
      setLineas([])
      setProductoId('')
      setCantidad(1)
      const inventario = await api<InventarioRespuesta>(`/inventario?bodega_id=${bodegaId}`, { token })
      setExistencias(inventario.items.filter((item) => ids.has(item.producto_id)))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  const nombreDe = (id: string) => {
    const producto = productos.items.find((fila) => fila.id === id)
    return producto ? `${producto.sku} · ${producto.nombre}` : id
  }

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Entrada de mercancía">
        <MenuInventario escritura />
      </Encabezado>
      <div className="ficha">
        {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
        <label>
          Proveedor
          <select value={proveedorId} onChange={(evento) => setProveedorId(evento.target.value)}>
            <option value="">Selecciona</option>
            {proveedores.items.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>)}
          </select>
        </label>
        {proveedores.items.length === 0 && !proveedores.error && <p className="nota">No hay proveedores. El administrador los registra en Catálogo.</p>}
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
            {productos.items.map((producto) => <option key={producto.id} value={producto.id}>{producto.sku} · {producto.nombre}</option>)}
          </select>
        </label>
        <label>
          Cantidad
          <input type="number" min={1} value={cantidad} onChange={(evento) => setCantidad(Number(evento.target.value))} />
        </label>
        <button type="button" disabled={!lineaValida} onClick={agregar}>Agregar línea</button>
        {lineas.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Producto</th><th className="num">Cantidad</th><th /></tr></thead>
              <tbody>
                {lineas.map((linea) => (
                  <tr key={linea.producto_id}>
                    <td>{nombreDe(linea.producto_id)}</td>
                    <td className="num">{linea.cantidad}</td>
                    <td><button type="button" onClick={() => setLineas((actual) => actual.filter((fila) => fila.producto_id !== linea.producto_id))}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="boton-primario" disabled={!listo} onClick={() => void enviar()}>Registrar entrada</button>
        {recepcion && <p className="nota-ok">Recepción {recepcion.codigo}</p>}
        {recepcion && <p>Estado {recepcion.estado}</p>}
        {existencias.map((item) => <p key={item.producto_id}>{item.sku}: disponible {item.disponible}</p>)}
      </div>
    </section>
  )
}

function sumar(lineas: LineaEntrada[], nueva: LineaEntrada): LineaEntrada[] {
  const existe = lineas.some((linea) => linea.producto_id === nueva.producto_id)
  if (!existe) return [...lineas, nueva]
  return lineas.map((linea) => linea.producto_id === nueva.producto_id ? { ...linea, cantidad: linea.cantidad + nueva.cantidad } : linea)
}
