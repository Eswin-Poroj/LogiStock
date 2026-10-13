import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { PedidoResumen, TareaPicking } from '../dominio/tipos'
import { agruparTareas, tituloColumna } from './columnas'
import type { ColumnaPedido } from './columnas'
import { leerTareas } from './leerTareas'
import { MenuPicking } from './MenuPicking'

export function TableroPicking() {
  const { token } = useSesion()
  const [tareas, setTareas] = useState<TareaPicking[]>([])
  const [despachados, setDespachados] = useState<PedidoResumen[]>([])
  const [entregados, setEntregados] = useState<PedidoResumen[]>([])
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<unknown>('/picking/tareas', { token })
      .then(async (cuerpo) => {
        if (!vivo) return
        const lista = leerTareas(cuerpo)
        setTareas(lista)
        const [despacho, entrega] = await Promise.all([
          api<PedidoResumen[]>('/pedidos?estado=despachado&limite=20', { token }),
          api<PedidoResumen[]>('/pedidos?estado=entregado&limite=20', { token }),
        ])
        if (!vivo) return
        setDespachados(Array.isArray(despacho) ? despacho : [])
        setEntregados(Array.isArray(entrega) ? entrega : [])
      })
      .catch((fallo: unknown) => {
        if (vivo && fallo instanceof ApiError) setError(fallo)
      })
    return () => { vivo = false }
  }, [token])

  const grupos = agruparTareas(tareas)
  const columnas: { id: ColumnaPedido; tareas: TareaPicking[]; pedidos: PedidoResumen[] }[] = [
    { id: 'creado', tareas: grupos.creado, pedidos: [] },
    { id: 'en_preparacion', tareas: grupos.en_preparacion, pedidos: [] },
    { id: 'despachado', tareas: [], pedidos: despachados },
    { id: 'entregado', tareas: [], pedidos: entregados },
  ]

  return (
    <section>
      <MenuPicking />
      <h1>Preparación de pedidos</h1>
      {error && <AvisoApi error={error} />}
      <div className="columnas-pedido">
        {columnas.map((columna) => (
          <section key={columna.id} aria-label={tituloColumna(columna.id)}>
            <h2>{tituloColumna(columna.id)}</h2>
            <p>{columna.tareas.length + columna.pedidos.length}</p>
            {columna.tareas.map((tarea) => (
              <article key={tarea.id}>
                <Link to={`/picking/tarea?id=${tarea.id}`}>{tarea.numero_pedido ?? tarea.pedido_id}</Link>
                {tarea.cliente && <p>{tarea.cliente}</p>}
              </article>
            ))}
            {columna.pedidos.map((pedido) => (
              <article key={pedido.id}>
                <p>{pedido.numero}</p>
                <p>{pedido.cliente}</p>
                <p>{quetzales(pedido.total)}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
