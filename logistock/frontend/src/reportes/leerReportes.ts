export interface ResumenReporte {
  pedidos_despachados: number
  entregas_a_tiempo_pct: number
  rotacion: number
  pedidos_backorder: number
  despachos_por_dia: { etiqueta: string; cantidad: number }[]
}

export interface FilaVendida { sku: string; producto: string; unidades: number }
export interface AlertaStock { sku: string; producto: string; disponible: number; estado: 'reponer' | 'agotado' }

function esDia(valor: unknown): valor is { etiqueta: string; cantidad: number } {
  if (!valor || typeof valor !== 'object') return false
  const dia = valor as { etiqueta?: unknown; cantidad?: unknown }
  return typeof dia.etiqueta === 'string' && typeof dia.cantidad === 'number'
}

export function esResumen(valor: unknown): valor is ResumenReporte {
  if (!valor || typeof valor !== 'object') return false
  const fila = valor as ResumenReporte
  return typeof fila.pedidos_despachados === 'number'
    && typeof fila.entregas_a_tiempo_pct === 'number'
    && typeof fila.rotacion === 'number'
    && typeof fila.pedidos_backorder === 'number'
    && Array.isArray(fila.despachos_por_dia)
    && fila.despachos_por_dia.every(esDia)
}

export function esVendidos(valor: unknown): valor is FilaVendida[] {
  return Array.isArray(valor) && valor.every((fila) => {
    const item = fila as FilaVendida
    return typeof item.sku === 'string' && typeof item.producto === 'string' && typeof item.unidades === 'number'
  })
}

export function esAlertas(valor: unknown): valor is AlertaStock[] {
  return Array.isArray(valor) && valor.every((fila) => {
    const item = fila as AlertaStock
    return typeof item.sku === 'string' && typeof item.producto === 'string' && typeof item.disponible === 'number' && (item.estado === 'reponer' || item.estado === 'agotado')
  })
}
