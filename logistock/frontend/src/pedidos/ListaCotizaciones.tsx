import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { BuscadorTabla, Paginador } from '../comun/Paginador'
import { eliminarConConfirmacion, useTablaPaginada } from '../comun/paginar'
import { quetzales } from '../dominio/quetzales'
import type { CotizacionResumen } from '../dominio/tipos'
import { Encabezado } from '../navegacion/Encabezado'
import { MenuPedidos } from './MenuPedidos'

export function ListaCotizaciones() {
  const { token } = useSesion()
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const tabla = useTablaPaginada(cotizaciones, (c) => `${c.numero} ${c.cliente}`)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<CotizacionResumen[]>('/cotizaciones', { token })
      .then((filas) => { if (vivo) setCotizaciones(filas) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token])

  async function eliminar(c: CotizacionResumen) {
    setError(null)
    if (await eliminarConConfirmacion(token, `/cotizaciones/${c.id}`, `¿Eliminar la cotización ${c.numero}?`, setError)) {
      setCotizaciones((filas) => filas.filter((fila) => fila.id !== c.id))
    }
  }

  return (
    <section className="pantalla">
      <Encabezado titulo="Cotizaciones">
        <MenuPedidos />
      </Encabezado>
      <section className="tarjeta" aria-label="Lista de cotizaciones">
        <div className="encabezado-tabla">
          <h2>Cotizaciones ({cotizaciones.length})</h2>
          <BuscadorTabla valor={tabla.busqueda} onCambio={tabla.setBusqueda} placeholder="Número o cliente" />
        </div>
        {error && <AvisoApi error={error} />}
        {cotizaciones.length === 0 && !error && <p className="nota">Aún no hay cotizaciones guardadas.</p>}
        {tabla.visibles.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead><tr><th>Número</th><th>Cliente</th><th className="num">Total</th><th>Estado</th><th>Fecha</th><th /></tr></thead>
              <tbody>
                {tabla.visibles.map((c) => (
                  <tr key={c.id}>
                    <td className="sku">{c.numero}</td>
                    <td>{c.cliente}</td>
                    <td className="num">{quetzales(c.total)}</td>
                    <td>{c.pedido_id ? <span className="pastilla pastilla-ok">Convertida</span> : <span className="pastilla pastilla-info">Abierta</span>}</td>
                    <td>{new Date(c.created_at).toLocaleDateString('es-GT')}</td>
                    <td className="acciones-fila">
                      {c.pedido_id
                        ? <Link to={`/pedidos/${c.pedido_id}`}>Ver pedido</Link>
                        : <Link to={`/pedidos?cotizacion=${c.id}`} aria-label={`Abrir ${c.numero}`}>Abrir</Link>}
                      <button type="button" className="boton-peligro" aria-label={`Eliminar ${c.numero}`} onClick={() => void eliminar(c)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginador pagina={tabla.pagina} paginas={tabla.paginas} total={tabla.total} onPagina={tabla.setPagina} etiqueta="cotizaciones" />
      </section>
    </section>
  )
}
