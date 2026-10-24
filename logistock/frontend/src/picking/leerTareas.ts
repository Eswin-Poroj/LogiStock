import type { EstadoPicking, TareaPicking } from '../dominio/tipos'

const ESTADOS: EstadoPicking[] = ['pendiente', 'en_curso', 'completado', 'con_faltante']

function esTarea(valor: unknown): valor is TareaPicking {
  if (!valor || typeof valor !== 'object') return false
  const fila = valor as { id?: unknown; pedido_id?: unknown; estado?: unknown; lineas?: unknown }
  return typeof fila.id === 'string' && typeof fila.pedido_id === 'string' && typeof fila.estado === 'string' && ESTADOS.includes(fila.estado as EstadoPicking) && Array.isArray(fila.lineas)
}

export function leerTareas(valor: unknown): TareaPicking[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(esTarea)
}
