import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { Paginador } from '../comun/Paginador'
import { confirmar, paginar } from '../comun/paginar'
import { Encabezado } from '../navegacion/Encabezado'
import { MenuInventario } from './MenuInventario'

interface Solicitud {
  id: string
  sku: string
  nombre: string
  bodega: string
  cantidad: number
  disponible: number
  motivo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  solicitado_por: string
  revisado_por: string | null
  created_at: string
}

/** CU-04 A1: el administrador aprueba o rechaza los ajustes grandes; el operario ve en qué quedaron. */
export function Aprobaciones() {
  const { token, usuario } = useSesion()
  const esAdmin = usuario?.rol === 'administrador'
  const [estado, setEstado] = useState<Solicitud['estado']>('pendiente')
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const vista = paginar(solicitudes, pagina)

  useEffect(() => {
    if (!token) return
    let vivo = true
    setPagina(1)
    api<Solicitud[]>(`/inventario/ajustes/pendientes?estado=${estado}`, { token })
      .then((filas) => { if (vivo) setSolicitudes(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, estado])

  async function resolver(s: Solicitud, aprobar: boolean) {
    if (!token) return
    const pregunta = aprobar
      ? `¿Aprobar el ajuste de ${s.cantidad > 0 ? '+' : ''}${s.cantidad} en ${s.sku}? El disponible pasará de ${s.disponible} a ${s.disponible + s.cantidad}.`
      : `¿Rechazar el ajuste de ${s.cantidad} en ${s.sku}?`
    if (!confirmar(pregunta)) return
    setError(null)
    try {
      await api(`/inventario/ajustes/${s.id}/${aprobar ? 'aprobar' : 'rechazar'}`, { method: 'POST', token })
      setSolicitudes((filas) => filas.filter((fila) => fila.id !== s.id))
      setAviso(`Ajuste de ${s.sku} ${aprobar ? 'aprobado y aplicado' : 'rechazado'}`)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section className="pantalla">
      <Encabezado titulo={esAdmin ? 'Aprobación de ajustes' : 'Solicitudes de ajuste'}>
        <MenuInventario escritura />
      </Encabezado>
      <section className="tarjeta" aria-label="Solicitudes de ajuste">
        <div className="encabezado-tabla">
          <h2>Ajustes {estado === 'pendiente' ? 'pendientes' : estado === 'aprobado' ? 'aprobados' : 'rechazados'} ({solicitudes.length})</h2>
          <label className="filtro-estado">
            <span className="solo-lectores">Estado</span>
            <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as Solicitud['estado'])}>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
            </select>
          </label>
        </div>
        {error && <AvisoApi error={error} />}
        {aviso && <p className="nota-ok" role="status">{aviso}</p>}
        {solicitudes.length === 0 && !error && <p className="nota">No hay solicitudes en este estado.</p>}
        {vista.visibles.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>SKU</th><th>Producto</th><th>Bodega</th><th className="num">Ajuste</th><th className="num">Disponible</th><th>Motivo</th><th>Solicitó</th><th /></tr></thead>
              <tbody>
                {vista.visibles.map((s) => (
                  <tr key={s.id}>
                    <td className="sku">{s.sku}</td>
                    <td>{s.nombre}</td>
                    <td>{s.bodega}</td>
                    <td className="num">{s.cantidad > 0 ? `+${s.cantidad}` : s.cantidad}</td>
                    <td className="num">{s.disponible}</td>
                    <td>{s.motivo}</td>
                    <td>{s.solicitado_por}{s.revisado_por ? ` · revisó ${s.revisado_por}` : ''}</td>
                    <td className="acciones-fila">
                      {esAdmin && s.estado === 'pendiente' && (
                        <>
                          <button type="button" aria-label={`Aprobar ${s.sku}`} onClick={() => void resolver(s, true)}>Aprobar</button>
                          <button type="button" className="boton-peligro" aria-label={`Rechazar ${s.sku}`} onClick={() => void resolver(s, false)}>Rechazar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={vista.pagina} paginas={vista.paginas} total={solicitudes.length} onPagina={setPagina} etiqueta="solicitudes" />
      </section>
    </section>
  )
}
