import { useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import type { Bodega, EntradaNueva, Producto, Recepcion } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { accesoDe } from '../navegacion/modulos'
import { MenuInventario } from './MenuInventario'
import { Encabezado } from '../navegacion/Encabezado'

export function FormularioEntrada() {
  const { token, usuario } = useSesion()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const productos = useListado<Producto>('/productos', token)
  const [proveedorId, setProveedorId] = useState('')
  const [bodegaId, setBodegaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState<ApiError | null>(null)
  const [recepcion, setRecepcion] = useState<Recepcion | null>(null)
  const listaError = bodegas.error ?? productos.error
  const listo = esUuid(proveedorId) && esUuid(bodegaId) && esUuid(productoId) && Number.isInteger(cantidad) && cantidad >= 1

  if (!usuario || accesoDe(usuario.rol, 'inventario') !== 'escritura') {
    return <p role="alert">Inventario es de solo lectura para tu rol.</p>
  }

  async function enviar() {
    if (!token || !listo) return
    setError(null)
    const body: EntradaNueva = { proveedor_id: proveedorId, bodega_id: bodegaId, lineas: [{ producto_id: productoId, cantidad }] }
    try {
      setRecepcion(await api<Recepcion>('/inventario/entradas', { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Entrada">
        <MenuInventario escritura />
      </Encabezado>
      <div className="ficha">
        {(listaError || error) && <AvisoApi error={(listaError ?? error) as ApiError} />}
        <label>
          Proveedor
          <input value={proveedorId} onChange={(evento) => setProveedorId(evento.target.value)} />
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
        <button type="button" className="boton-primario" disabled={!listo} onClick={() => void enviar()}>Registrar entrada</button>
        {recepcion && <p className="nota-ok">Recepción {recepcion.codigo}</p>}
        {recepcion && <p>Estado {recepcion.estado}</p>}
      </div>
    </section>
  )
}
