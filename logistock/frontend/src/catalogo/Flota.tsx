import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Conductor, Vehiculo } from '../dominio/tipos'
import { BuscadorTabla, Paginador } from '../comun/Paginador'
import { eliminarConConfirmacion, useTablaPaginada } from '../comun/paginar'

/** Lista que incluye inactivos y permite crear y activar o desactivar. */
function useCatalogoActivable<T extends { id: string; activo?: boolean }>(ruta: string) {
  const { token } = useSesion()
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<T[]>(`${ruta}?incluir_inactivos=true`, { token })
      .then((filas) => { if (vivo) setItems(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [ruta, token])

  async function crear(body: Record<string, unknown>): Promise<boolean> {
    if (!token) return false
    setError(null)
    try {
      const creado = await api<T>(ruta, { method: 'POST', token, body })
      setItems((actuales) => [...actuales, creado])
      return true
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
      return false
    }
  }

  async function alternar(item: T) {
    if (!token) return
    setError(null)
    try {
      const cambiado = await api<T>(`${ruta}/${item.id}`, { method: 'PATCH', token, body: { activo: !item.activo } })
      setItems((actuales) => actuales.map((fila) => fila.id === item.id ? cambiado : fila))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function eliminar(item: T, nombre: string) {
    setError(null)
    if (await eliminarConConfirmacion(token, `${ruta}/${item.id}`, `¿Eliminar ${nombre}?`, setError)) {
      setItems((actuales) => actuales.filter((fila) => fila.id !== item.id))
    }
  }

  return { items, error, crear, alternar, eliminar }
}

function Estado({ activo }: { activo?: boolean }) {
  return <span className={activo ? 'pastilla pastilla-ok' : 'pastilla pastilla-error'}>{activo ? 'Activo' : 'Inactivo'}</span>
}

export function Vehiculos() {
  const vehiculos = useCatalogoActivable<Vehiculo>('/vehiculos')
  const tabla = useTablaPaginada(vehiculos.items, (v) => `${v.nombre} ${v.placa ?? ''}`)
  const [nombre, setNombre] = useState('')
  const [placa, setPlaca] = useState('')
  const [capacidad, setCapacidad] = useState('')
  const capacidadNum = Number(capacidad)
  const listo = nombre.trim() !== '' && placa.trim() !== '' && Number.isInteger(capacidadNum) && capacidadNum >= 1

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!listo) return
    if (await vehiculos.crear({ nombre: nombre.trim(), placa: placa.trim(), capacidad_kg: capacidadNum })) {
      setNombre('')
      setPlaca('')
      setCapacidad('')
    }
  }

  return (
    <div className="catalogo-rejilla">
      {vehiculos.error && <div className="aviso-ancho"><AvisoApi error={vehiculos.error} /></div>}
      <section className="tarjeta" aria-label="Nuevo vehículo">
        <h2>Nuevo vehículo</h2>
        <form className="campos-catalogo" onSubmit={(evento) => void enviar(evento)}>
          <label>Nombre<input value={nombre} placeholder="Camión 03" onChange={(e) => setNombre(e.target.value)} /></label>
          <label>Placa<input value={placa} placeholder="C-123ABC" onChange={(e) => setPlaca(e.target.value)} /></label>
          <label>Capacidad (kg)<input type="number" min={1} step={1} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} /></label>
          <button type="submit" className="boton-primario" disabled={!listo}>Guardar vehículo</button>
        </form>
      </section>
      <section className="tarjeta" aria-label="Vehículos">
        <div className="encabezado-tabla">
          <h2>Vehículos ({vehiculos.items.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Nombre o placa" />
        </div>
        <p className="nota">Solo los activos se pueden elegir al planificar un despacho.</p>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>Placa</th><th className="num">Capacidad</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {tabla.visibles.map((v) => (
                <tr key={v.id}>
                  <td>{v.nombre}</td><td className="sku">{v.placa}</td><td className="num">{v.capacidad_kg} kg</td><td><Estado activo={v.activo} /></td>
                  <td className="acciones-fila">
                    <button type="button" aria-label={`${v.activo ? 'Desactivar' : 'Activar'} ${v.nombre}`} onClick={() => void vehiculos.alternar(v)}>{v.activo ? 'Desactivar' : 'Activar'}</button>
                    <button type="button" className="boton-peligro" aria-label={`Eliminar ${v.nombre}`} onClick={() => void vehiculos.eliminar(v, `el vehículo ${v.nombre} (${v.placa})`)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="vehículos" />
      </section>
    </div>
  )
}

export function Conductores() {
  const conductores = useCatalogoActivable<Conductor>('/conductores')
  const tabla = useTablaPaginada(conductores.items, (c) => `${c.nombre} ${c.telefono ?? ''}`)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!nombre.trim()) return
    const body: Record<string, string> = { nombre: nombre.trim() }
    if (telefono.trim()) body.telefono = telefono.trim()
    if (await conductores.crear(body)) {
      setNombre('')
      setTelefono('')
    }
  }

  return (
    <div className="catalogo-rejilla">
      {conductores.error && <div className="aviso-ancho"><AvisoApi error={conductores.error} /></div>}
      <section className="tarjeta" aria-label="Nuevo conductor">
        <h2>Nuevo conductor</h2>
        <form className="campos-catalogo" onSubmit={(evento) => void enviar(evento)}>
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <label>Teléfono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></label>
          <button type="submit" className="boton-primario" disabled={!nombre.trim()}>Guardar conductor</button>
        </form>
      </section>
      <section className="tarjeta" aria-label="Conductores">
        <div className="encabezado-tabla">
          <h2>Conductores ({conductores.items.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Nombre o teléfono" />
        </div>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {tabla.visibles.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td><td>{c.telefono ?? '—'}</td><td><Estado activo={c.activo} /></td>
                  <td className="acciones-fila">
                    <button type="button" aria-label={`${c.activo ? 'Desactivar' : 'Activar'} ${c.nombre}`} onClick={() => void conductores.alternar(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                    <button type="button" className="boton-peligro" aria-label={`Eliminar ${c.nombre}`} onClick={() => void conductores.eliminar(c, `al conductor ${c.nombre}`)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="conductores" />
      </section>
    </div>
  )
}
