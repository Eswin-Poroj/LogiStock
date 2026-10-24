import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useListado } from '../api/useListado'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { Bodega, Cliente, Producto, Proveedor } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { FormularioCliente } from './FormularioCliente'
import { BuscadorTabla, Paginador } from '../comun/Paginador'
import { eliminarConConfirmacion, useTablaPaginada } from '../comun/paginar'
import { Conductores, Vehiculos } from './Flota'
import { Bodegas } from './Bodegas'

type Seccion = 'productos' | 'bodegas' | 'proveedores' | 'clientes' | 'vehiculos' | 'conductores'

const SECCIONES: { id: Seccion; etiqueta: string }[] = [
  { id: 'productos', etiqueta: 'Productos' },
  { id: 'bodegas', etiqueta: 'Bodegas' },
  { id: 'proveedores', etiqueta: 'Proveedores' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'vehiculos', etiqueta: 'Vehículos' },
  { id: 'conductores', etiqueta: 'Conductores' },
]

export function Catalogo() {
  const [seccion, setSeccion] = useState<Seccion>('productos')
  return (
    <section className="pantalla">
      <Encabezado titulo="Catálogo">
        <nav className="subnav" aria-label="Catálogo">
          {SECCIONES.map(({ id, etiqueta }) => (
            <button key={id} type="button" aria-pressed={seccion === id} onClick={() => setSeccion(id)}>{etiqueta}</button>
          ))}
        </nav>
      </Encabezado>
      {seccion === 'productos' && <Productos />}
      {seccion === 'bodegas' && <Bodegas />}
      {seccion === 'proveedores' && <Proveedores />}
      {seccion === 'clientes' && <Clientes />}
      {seccion === 'vehiculos' && <Vehiculos />}
      {seccion === 'conductores' && <Conductores />}
    </section>
  )
}

function Productos() {
  const { token } = useSesion()
  const bodegas = useListado<Bodega>('/bodegas', token)
  const [productos, setProductos] = useState<Producto[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<Producto[]>('/productos?limite=500&incluir_inactivos=true', { token })
      .then((filas) => { if (vivo) setProductos(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  const tabla = useTablaPaginada(productos, (p) => `${p.sku} ${p.nombre} ${p.categoria ?? ''}`)

  // Si no se puede borrar por historial, se ofrece desactivarlo en el mismo aviso.
  const [conHistorial, setConHistorial] = useState<Producto | null>(null)

  async function eliminar(producto: Producto) {
    setError(null)
    setAviso(null)
    setConHistorial(null)
    const ok = await eliminarConConfirmacion(token, `/productos/${producto.id}`, `¿Eliminar ${producto.sku} · ${producto.nombre}? Esta acción no se puede deshacer.`, (fallo) => {
      setError(fallo)
      if (fallo.status === 409 && producto.activo) setConHistorial(producto)
    })
    if (!ok) return
    setProductos((actuales) => actuales.filter((fila) => fila.id !== producto.id))
    if (editando?.id === producto.id) setEditando(null)
    setAviso(`Producto ${producto.sku} eliminado`)
  }

  async function desactivar(producto: Producto) {
    if (!token) return
    setError(null)
    setConHistorial(null)
    try {
      guardado(await api<Producto>(`/productos/${producto.id}`, { method: 'PATCH', token, body: { activo: false } }), `Producto ${producto.sku} desactivado: ya no aparece para la venta y conserva su historial.`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  function guardado(producto: Producto, mensaje: string) {
    setProductos((actuales) => {
      const resto = actuales.filter((fila) => fila.id !== producto.id)
      return [...resto, producto].sort((a, b) => a.sku.localeCompare(b.sku))
    })
    setEditando(null)
    setAviso(mensaje)
  }

  return (
    <div className="catalogo-rejilla">
      <section className="tarjeta" aria-label={editando ? 'Editar producto' : 'Nuevo producto'}>
        <h2>{editando ? `Editar ${editando.sku}` : 'Nuevo producto'}</h2>
        <FormularioProducto key={editando?.id ?? 'nuevo'} producto={editando} bodegas={bodegas.items} categorias={[...new Set(productos.map((p) => p.categoria).filter((c): c is string => !!c))].sort()} onGuardado={guardado} onCancelar={() => setEditando(null)} />
        {aviso && <p className="nota-ok" role="status">{aviso}</p>}
      </section>
      <section className="tarjeta" aria-label="Productos">
        <div className="encabezado-tabla">
          <h2>Productos ({productos.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="SKU, nombre o categoría" />
        </div>
        {(error ?? bodegas.error) && <AvisoApi error={(error ?? bodegas.error) as ApiError} />}
        {conHistorial && (
          <div className="accion-alternativa">
            <span>{conHistorial.sku} tiene historial, así que no se borra. Puedes desactivarlo: deja de venderse y su historial queda intacto.</span>
            <button type="button" onClick={() => void desactivar(conHistorial)}>Desactivar en su lugar</button>
          </div>
        )}
        {productos.length === 0 && !error && <p className="nota">Aún no hay productos. Crea el primero con el formulario.</p>}
        {productos.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th className="num">Precio</th><th className="num">Mínimo</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {tabla.visibles.map((producto) => (
                  <tr key={producto.id} className={editando?.id === producto.id ? 'fila-activa' : undefined}>
                    <td className="sku">{producto.sku}</td>
                    <td>{producto.nombre}</td>
                    <td>{producto.categoria ?? '—'}</td>
                    <td className="num">{quetzales(Number(producto.precio_unitario))}</td>
                    <td className="num">{producto.stock_minimo}</td>
                    <td><span className={producto.activo ? 'pastilla pastilla-ok' : 'pastilla pastilla-error'}>{producto.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="acciones-fila">
                      <button type="button" aria-label={`Editar ${producto.sku}`} onClick={() => { setAviso(null); setEditando(producto) }}>Editar</button>
                      <button type="button" className="boton-peligro" aria-label={`Eliminar ${producto.sku}`} onClick={() => void eliminar(producto)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="productos" />
      </section>
    </div>
  )
}

/** Misma regla que el backend: "Ferretería" → "FER". */
export function prefijoDe(categoria: string): string {
  const letras = categoria.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase()
  return letras.length >= 2 ? letras.slice(0, 3) : 'PRD'
}

function FormularioProducto({ producto, bodegas, categorias, onGuardado, onCancelar }: {
  producto: Producto | null
  bodegas: Bodega[]
  categorias: string[]
  onGuardado: (producto: Producto, mensaje: string) => void
  onCancelar: () => void
}) {
  const { token } = useSesion()
  const [categoria, setCategoria] = useState(producto?.categoria ?? '')
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [unidad, setUnidad] = useState(producto?.unidad ?? 'unidad')
  const [precio, setPrecio] = useState(producto ? String(producto.precio_unitario) : '')
  const [minimo, setMinimo] = useState(producto ? String(producto.stock_minimo) : '0')
  const [peso, setPeso] = useState(producto ? String(producto.peso_kg ?? 0) : '0')
  const [activo, setActivo] = useState(producto?.activo ?? true)
  const [bodegaId, setBodegaId] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const precioNum = Number(precio)
  const minimoNum = Number(minimo)
  const prefijo = prefijoDe(categoria)
  const pesoNum = Number(peso)
  const listo = categoria.trim() !== '' && nombre.trim() !== '' && precio !== '' && precioNum >= 0 && Number.isInteger(minimoNum) && minimoNum >= 0 && peso !== '' && pesoNum >= 0

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!token || !listo) return
    setError(null)
    const body: Record<string, unknown> = { categoria: categoria.trim(), nombre: nombre.trim(), unidad: unidad.trim() || 'unidad', precio_unitario: precioNum, stock_minimo: minimoNum, peso_kg: pesoNum }
    if (bodegaId) { body.bodega_id = bodegaId; body.ubicacion = ubicacion.trim() }
    try {
      if (producto) {
        body.activo = activo
        onGuardado(await api<Producto>(`/productos/${producto.id}`, { method: 'PATCH', token, body }), `Producto ${producto.sku} actualizado`)
      } else {
        const creado = await api<Producto>('/productos', { method: 'POST', token, body })
        onGuardado(creado, `Producto ${creado.sku} creado. Registra su stock con una entrada de mercancía.`)
      }
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <form className="campos-catalogo" onSubmit={(evento) => void enviar(evento)}>
      {error && <AvisoApi error={error} />}
      <label>
        Categoría
        <input list="categorias-producto" value={categoria} placeholder="Ferretería" onChange={(e) => setCategoria(e.target.value)} />
      </label>
      <datalist id="categorias-producto">
        {categorias.map((nombreCategoria) => <option key={nombreCategoria} value={nombreCategoria} />)}
      </datalist>
      <p className="nota" aria-live="polite">
        {producto ? <>SKU <strong>{producto.sku}</strong> (no cambia)</> : categoria.trim() ? <>SKU automático: <strong>{prefijo}-####</strong></> : 'El SKU se genera solo a partir de la categoría.'}
      </p>
      <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
      <label>Unidad<input value={unidad} onChange={(e) => setUnidad(e.target.value)} /></label>
      <label>Precio unitario (Q)<input type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} /></label>
      <label>Stock mínimo<input type="number" min={0} step={1} value={minimo} onChange={(e) => setMinimo(e.target.value)} /></label>
      <label>Peso por unidad (kg)<input type="number" min={0} step="0.001" value={peso} onChange={(e) => setPeso(e.target.value)} /></label>
      {producto && (
        <label className="campo-casilla"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo para la venta</label>
      )}
      <label>
        Bodega de la ubicación
        <select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}>
          <option value="">Sin cambiar ubicación</option>
          {bodegas.map((bodega) => <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>)}
        </select>
      </label>
      <label>Ubicación en bodega<input value={ubicacion} disabled={!bodegaId} placeholder="A-03-2" onChange={(e) => setUbicacion(e.target.value)} /></label>
      <p className="nota">Los productos de la misma categoría se sugieren como sustitutos cuando falta stock.</p>
      <div className="acciones-formulario">
        <button type="submit" className="boton-primario" disabled={!listo}>{producto ? 'Guardar cambios' : 'Crear producto'}</button>
        {producto && <button type="button" onClick={onCancelar}>Cancelar edición</button>}
      </div>
    </form>
  )
}

function Proveedores() {
  const { token } = useSesion()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<Proveedor[]>('/proveedores', { token })
      .then((filas) => { if (vivo) setProveedores(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  const tabla = useTablaPaginada(proveedores, (p) => `${p.nombre} ${p.nit ?? ''} ${p.correo ?? ''}`)

  async function eliminar(proveedor: Proveedor) {
    setError(null)
    if (await eliminarConConfirmacion(token, `/proveedores/${proveedor.id}`, `¿Eliminar al proveedor ${proveedor.nombre}?`, setError)) {
      setProveedores((actuales) => actuales.filter((fila) => fila.id !== proveedor.id))
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!token || !nombre.trim()) return
    setError(null)
    const body: Record<string, string> = { nombre: nombre.trim() }
    if (nit.trim()) body.nit = nit.trim()
    if (telefono.trim()) body.telefono = telefono.trim()
    if (correo.trim()) body.correo = correo.trim()
    try {
      const creado = await api<Proveedor>('/proveedores', { method: 'POST', token, body })
      setProveedores((actuales) => [...actuales, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      for (const limpiar of [setNombre, setNit, setTelefono, setCorreo]) limpiar('')
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <div className="catalogo-rejilla">
      <section className="tarjeta" aria-label="Nuevo proveedor">
        <h2>Nuevo proveedor</h2>
        <form className="campos-catalogo" onSubmit={(evento) => void enviar(evento)}>
          {error && <AvisoApi error={error} />}
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label>NIT<input value={nit} onChange={(e) => setNit(e.target.value)} /></label>
          <label>Teléfono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></label>
          <label>Correo<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></label>
          <button type="submit" className="boton-primario" disabled={!nombre.trim()}>Guardar proveedor</button>
        </form>
      </section>
      <section className="tarjeta" aria-label="Proveedores">
        <div className="encabezado-tabla">
          <h2>Proveedores ({proveedores.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Nombre, NIT o correo" />
        </div>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>NIT</th><th>Teléfono</th><th>Correo</th><th /></tr></thead>
            <tbody>
              {tabla.visibles.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td><td>{p.nit ?? '—'}</td><td>{p.telefono ?? '—'}</td><td>{p.correo ?? '—'}</td>
                  <td><button type="button" className="boton-peligro" aria-label={`Eliminar ${p.nombre}`} onClick={() => void eliminar(p)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="proveedores" />
      </section>
    </div>
  )
}

function Clientes() {
  const { token } = useSesion()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const tabla = useTablaPaginada(clientes, (c) => `${c.nombre} ${c.nit} ${c.direccion ?? ''} ${c.municipio ?? ''}`)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<Cliente[]>('/clientes?limite=1000', { token })
      .then((filas) => { if (vivo) setClientes(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  async function eliminar(cliente: Cliente) {
    setError(null)
    if (await eliminarConConfirmacion(token, `/clientes/${cliente.id}`, `¿Eliminar al cliente ${cliente.nombre}?`, setError)) {
      setClientes((actuales) => actuales.filter((fila) => fila.id !== cliente.id))
    }
  }

  return (
    <div className="catalogo-rejilla">
      <section className="tarjeta" aria-label="Alta de cliente">
        <h2>Nuevo cliente</h2>
        <FormularioCliente onCreado={(cliente) => setClientes((actuales) => [cliente, ...actuales])} />
      </section>
      <section className="tarjeta" aria-label="Clientes">
        <div className="encabezado-tabla">
          <h2>Clientes ({clientes.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Nombre, NIT o dirección" />
        </div>
        {error && <AvisoApi error={error} />}
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>NIT</th><th>Dirección</th><th>Coordenadas</th><th /></tr></thead>
            <tbody>
              {tabla.visibles.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td><td>{c.nit}</td><td>{c.direccion ?? '—'}</td>
                  <td>{c.latitud != null && c.longitud != null ? `${c.latitud}, ${c.longitud}` : <span className="pastilla pastilla-error">Sin coordenadas</span>}</td>
                  <td><button type="button" className="boton-peligro" aria-label={`Eliminar ${c.nombre}`} onClick={() => void eliminar(c)}>Eliminar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="clientes" />
      </section>
    </div>
  )
}
