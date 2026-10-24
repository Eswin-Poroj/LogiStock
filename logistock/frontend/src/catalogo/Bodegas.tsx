import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Bodega } from '../dominio/tipos'
import { SelectorUbicacion } from './SelectorUbicacion'
import { BuscadorTabla, Paginador } from '../comun/Paginador'
import { eliminarConConfirmacion, useTablaPaginada } from '../comun/paginar'

/** Bodegas (Visión: múltiples almacenes). La ubicación es el punto de salida de las rutas. */
export function Bodegas() {
  const { token } = useSesion()
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [editando, setEditando] = useState<Bodega | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<Bodega[]>('/bodegas?incluir_inactivas=true', { token })
      .then((filas) => { if (vivo) setBodegas(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  function guardada(bodega: Bodega, mensaje: string) {
    setBodegas((actuales) => [...actuales.filter((fila) => fila.id !== bodega.id), bodega].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setEditando(null)
    setAviso(mensaje)
  }

  const tabla = useTablaPaginada(bodegas, (b) => `${b.nombre} ${b.direccion ?? ''}`)

  async function eliminar(bodega: Bodega) {
    setError(null)
    setAviso(null)
    if (await eliminarConConfirmacion(token, `/bodegas/${bodega.id}`, `¿Eliminar la bodega ${bodega.nombre}?`, setError)) {
      setBodegas((actuales) => actuales.filter((fila) => fila.id !== bodega.id))
      setAviso(`Bodega ${bodega.nombre} eliminada`)
    }
  }

  async function alternar(bodega: Bodega) {
    if (!token) return
    setError(null)
    try {
      const cambiada = await api<Bodega>(`/bodegas/${bodega.id}`, { method: 'PATCH', token, body: { activa: !bodega.activa } })
      guardada(cambiada, `Bodega ${cambiada.nombre} ${cambiada.activa ? 'activada' : 'desactivada'}`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <div className="catalogo-rejilla">
      <section className="tarjeta" aria-label={editando ? 'Editar bodega' : 'Nueva bodega'}>
        <h2>{editando ? `Editar ${editando.nombre}` : 'Nueva bodega'}</h2>
        <FormularioBodega key={editando?.id ?? 'nueva'} bodega={editando} onGuardada={guardada} onCancelar={() => setEditando(null)} />
        {aviso && <p className="nota-ok" role="status">{aviso}</p>}
      </section>
      <section className="tarjeta" aria-label="Bodegas">
        <div className="encabezado-tabla">
          <h2>Bodegas ({bodegas.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Nombre o dirección" />
        </div>
        {error && <AvisoApi error={error} />}
        <p className="nota">Solo las activas aparecen en pedidos, inventario y despacho.</p>
        <div className="tabla-contenedor">
          <table>
            <thead><tr><th>Nombre</th><th>Dirección</th><th>Ubicación</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {tabla.visibles.map((b) => (
                <tr key={b.id} className={editando?.id === b.id ? 'fila-activa' : undefined}>
                  <td>{b.nombre}</td>
                  <td>{b.direccion ?? '—'}</td>
                  <td>{b.latitud != null && b.longitud != null ? `${b.latitud}, ${b.longitud}` : <span className="pastilla pastilla-error">Sin ubicación</span>}</td>
                  <td><span className={b.activa ? 'pastilla pastilla-ok' : 'pastilla pastilla-error'}>{b.activa ? 'Activa' : 'Inactiva'}</span></td>
                  <td className="acciones-fila">
                    <button type="button" aria-label={`Editar ${b.nombre}`} onClick={() => { setAviso(null); setEditando(b) }}>Editar</button>
                    <button type="button" aria-label={`${b.activa ? 'Desactivar' : 'Activar'} ${b.nombre}`} onClick={() => void alternar(b)}>{b.activa ? 'Desactivar' : 'Activar'}</button>
                    <button type="button" className="boton-peligro" aria-label={`Eliminar ${b.nombre}`} onClick={() => void eliminar(b)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="bodegas" />
      </section>
    </div>
  )
}

function FormularioBodega({ bodega, onGuardada, onCancelar }: {
  bodega: Bodega | null
  onGuardada: (bodega: Bodega, mensaje: string) => void
  onCancelar: () => void
}) {
  const { token } = useSesion()
  const [nombre, setNombre] = useState(bodega?.nombre ?? '')
  const [direccion, setDireccion] = useState(bodega?.direccion ?? '')
  const [punto, setPunto] = useState<{ latitud: number; longitud: number } | null>(
    bodega?.latitud != null && bodega?.longitud != null ? { latitud: Number(bodega.latitud), longitud: Number(bodega.longitud) } : null,
  )
  const [error, setError] = useState<ApiError | null>(null)
  const listo = nombre.trim() !== '' && punto !== null

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!token || !listo || !punto) return
    setError(null)
    const body: Record<string, unknown> = { nombre: nombre.trim(), latitud: punto.latitud, longitud: punto.longitud }
    if (direccion.trim()) body.direccion = direccion.trim()
    try {
      if (bodega) onGuardada(await api<Bodega>(`/bodegas/${bodega.id}`, { method: 'PATCH', token, body }), `Bodega ${nombre.trim()} actualizada`)
      else {
        const creada = await api<Bodega>('/bodegas', { method: 'POST', token, body })
        onGuardada(creada, `Bodega ${creada.nombre} creada. Ya puedes registrar entradas de mercancía en ella.`)
      }
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <form className="campos-catalogo" onSubmit={(evento) => void enviar(evento)}>
      {error && <AvisoApi error={error} />}
      <label>Nombre<input value={nombre} placeholder="Bodega Central" onChange={(e) => setNombre(e.target.value)} /></label>
      <SelectorUbicacion
        latitud={punto?.latitud ?? null}
        longitud={punto?.longitud ?? null}
        onCambio={(lugar) => {
          setPunto({ latitud: lugar.latitud, longitud: lugar.longitud })
          if (lugar.direccion) setDireccion([lugar.direccion, lugar.municipio].filter(Boolean).join(', '))
        }}
      />
      <label>Dirección<input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></label>
      {!punto && <p className="nota">Marca la ubicación: es el punto de salida de las rutas de despacho.</p>}
      <div className="acciones-formulario">
        <button type="submit" className="boton-primario" disabled={!listo}>{bodega ? 'Guardar cambios' : 'Crear bodega'}</button>
        {bodega && <button type="button" onClick={onCancelar}>Cancelar edición</button>}
      </div>
    </form>
  )
}
