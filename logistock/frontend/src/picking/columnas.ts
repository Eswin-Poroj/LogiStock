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

export function agruparTareas<T extends { estado: EstadoPicking }>(tareas: T[]): Record<'creado' | 'en_preparacion', T[]> {
  return {
    creado: tareas.filter((tarea) => columnaDeTarea(tarea.estado) === 'creado'),
    en_preparacion: tareas.filter((tarea) => columnaDeTarea(tarea.estado) === 'en_preparacion'),
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
