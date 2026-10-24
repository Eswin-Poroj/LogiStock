/** Formas de `/reportes/*` tal como las define `docs/openapi.yaml`. */
export interface ResumenReporte {
  pedidos_despachados: number
  entregas_a_tiempo_pct: number
  rotacion_inventario: number
  pedidos_con_backorder: number
  despachos_por_dia: { fecha: string; cantidad: number }[]
}

export interface FilaVendida { sku: string; nombre: string; unidades: number }
export interface AlertaStock { sku: string; nombre: string; disponible: number; estado: 'stock_bajo' | 'agotado' }

function esDia(valor: unknown): valor is { fecha: string; cantidad: number } {
  if (!valor || typeof valor !== 'object') return false
  const dia = valor as { fecha?: unknown; cantidad?: unknown }
  return typeof dia.fecha === 'string' && typeof dia.cantidad === 'number'
}

export function esResumen(valor: unknown): valor is ResumenReporte {
  if (!valor || typeof valor !== 'object') return false
  const fila = valor as ResumenReporte
  return typeof fila.pedidos_despachados === 'number'
    && typeof fila.entregas_a_tiempo_pct === 'number'
    && typeof fila.rotacion_inventario === 'number'
    && typeof fila.pedidos_con_backorder === 'number'
    && Array.isArray(fila.despachos_por_dia)
    && fila.despachos_por_dia.every(esDia)
}

export function esVendidos(valor: unknown): valor is FilaVendida[] {
  return Array.isArray(valor) && valor.every((fila) => {
    const item = fila as FilaVendida
    return typeof item.sku === 'string' && typeof item.nombre === 'string' && typeof item.unidades === 'number'
  })
}

export function esAlertas(valor: unknown): valor is AlertaStock[] {
  return Array.isArray(valor) && valor.every((fila) => {
    const item = fila as AlertaStock
    return typeof item.sku === 'string' && typeof item.nombre === 'string' && typeof item.disponible === 'number' && (item.estado === 'stock_bajo' || item.estado === 'agotado')
  })
}

/** "2026-10-20" → "Mar 20". Se lee como fecha local para que la zona horaria no corra el día. */
export function etiquetaDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const nombre = new Date(anio, mes - 1, dia).toLocaleDateString('es-GT', { weekday: 'short' }).replace('.', '')
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${dia}`
}

/** Arma el query string solo con los filtros elegidos; sin filtros la ruta queda limpia. */
export function conFiltros(ruta: string, filtros: Record<string, string>): string {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== ''))
  const query = params.toString()
  return query ? `${ruta}?${query}` : ruta
}
