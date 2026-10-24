import type { EstadoPicking } from '../dominio/tipos'

export type ColumnaPedido = 'creado' | 'en_preparacion' | 'despachado' | 'entregado'

export function columnaDeTarea(estado: EstadoPicking): 'creado' | 'en_preparacion' {
  if (estado === 'pendiente') return 'creado'
  return 'en_preparacion'
}

export function tituloColumna(columna: ColumnaPedido): 'Creado' | 'En preparación' | 'Despachado' | 'Entregado' {
  if (columna === 'creado') return 'Creado'
  if (columna === 'en_preparacion') return 'En preparación'
  if (columna === 'despachado') return 'Despachado'
  return 'Entregado'
}

/**
 * Las tareas solo ocupan Creado y En preparación. Cuando su pedido ya salió (despachado o
 * entregado) el tablero lo muestra en esa columna como pedido, no otra vez como tarea.
 */
export function agruparTareas<T extends { estado: EstadoPicking; estado_pedido?: string }>(tareas: T[]): Record<'creado' | 'en_preparacion', T[]> {
  const enBodega = tareas.filter((tarea) => tarea.estado_pedido !== 'despachado' && tarea.estado_pedido !== 'entregado')
  return {
    creado: enBodega.filter((tarea) => columnaDeTarea(tarea.estado) === 'creado'),
    en_preparacion: enBodega.filter((tarea) => columnaDeTarea(tarea.estado) === 'en_preparacion'),
  }
}

/**
 * Texto de avance que muestra la tarjeta de una tarea en el tablero (figura 7: "Picking en curso · 1 de 2").
 * Devuelve null cuando la tarjeta no debe mostrar avance.
 */
export function progresoTarea(tarea: { estado: EstadoPicking; lineas: { cantidad: number; cantidad_recogida: number }[] }): string | null {
  // TODO(usuario): decide qué cuenta como avance y en qué estados se muestra.
  void tarea
  return null
}
