import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import { quetzales } from '../dominio/quetzales'
import type { PedidoResumen, TareaPicking } from '../dominio/tipos'
import { accesoDe } from '../navegacion/modulos'
import { Encabezado } from '../navegacion/Encabezado'
import { agruparTareas, progresoTarea, tituloColumna } from './columnas'
import type { ColumnaPedido } from './columnas'
import { DetalleTarea } from './DetalleTarea'
import { leerTareas } from './leerTareas'
import { MenuPicking } from './MenuPicking'

/** Figura 7: "2 líneas · Q 2,940.00"; omite lo que la API no mandó. */
export function resumenTarjeta(lineas: number | undefined, total: number | undefined): string {
  const partes: string[] = []
  if (lineas !== undefined) partes.push(`${lineas} ${lineas === 1 ? 'línea' : 'líneas'}`)
  if (total !== undefined) partes.push(quetzales(Number(total)))
  return partes.join(' · ')
}

export function TableroPicking() {
  const { token, usuario } = useSesion()
  const [tareaId, setTareaId] = useState<string | null>(null)
  const [ranura, setRanura] = useState<HTMLDivElement | null>(null)
  const lectura = !usuario || accesoDe(usuario.rol, 'picking') !== 'escritura'
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
    <section className="pantalla">
      <Encabezado titulo="Preparación de pedidos">
        <MenuPicking />
        <div className="escaneo-encabezado" ref={setRanura} />
      </Encabezado>
      {error && <AvisoApi error={error} />}
      <div className="columnas-pedido">
        {columnas.map((columna) => (
          <section key={columna.id} aria-label={tituloColumna(columna.id)}>
            <header className="columna-encabezado">
              <h2>{tituloColumna(columna.id)}</h2>
              <p className="cuenta">{columna.tareas.length + columna.pedidos.length}</p>
            </header>
            {columna.tareas.map((tarea) => {
              const progreso = progresoTarea(tarea)
              return (
                <article key={tarea.id} className={tarea.id === tareaId ? 'tarjeta-tarea activa' : 'tarjeta-tarea'}>
                  <Link className="numero" to={`/picking/tarea?id=${tarea.id}`}>{tarea.numero_pedido ?? tarea.pedido_id}</Link>
                  {tarea.cliente && <p className="cliente">{tarea.cliente}</p>}
                  <p className="resumen">{resumenTarjeta(tarea.lineas.length, tarea.total)}</p>
                  {progreso && <p className="progreso">{progreso}</p>}
                  {tarea.estado === 'completado' && <p className="progreso">Listo para despacho</p>}
                  {tarea.estado === 'con_faltante' && <p className="progreso texto-alerta">Con faltante</p>}
                  <button type="button" onClick={() => setTareaId(tarea.id)}>Abrir</button>
                </article>
              )
            })}
            {columna.pedidos.map((pedido) => (
              <article key={pedido.id} className="tarjeta-tarea">
                <p className="numero">{pedido.numero}</p>
                <p className="cliente">{pedido.cliente}</p>
                <p className="resumen">{resumenTarjeta(pedido.lineas, pedido.total)}</p>
                {pedido.despacho && <p className="ruta-tarjeta">Ruta {pedido.despacho.codigo} · {pedido.despacho.vehiculo}</p>}
              </article>
            ))}
          </section>
        ))}
      </div>
      <DetalleTarea tareaId={tareaId} lectura={lectura} ranuraEscaneo={ranura} onActualizada={(tarea) => setTareas((actuales) => actuales.map((fila) => fila.id === tarea.id ? { ...fila, ...tarea } : fila))} />
    </section>
  )
}
