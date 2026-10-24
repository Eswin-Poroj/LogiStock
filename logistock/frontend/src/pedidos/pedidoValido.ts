import { esUuid } from '../dominio/uuid'
import type { PoliticaFaltantes } from '../dominio/tipos'

export function lineaSinStock(disponible: number, cantidad: number): boolean {
  return disponible < cantidad
}

export const IVA_PORCENTAJE = 12

export type ResolucionLinea = 'pendiente' | 'ajustada' | 'backorder'

export interface LineaCotizacion {
  producto_id: string
  sku: string
  nombre: string
  cantidad: number
  disponible: number | null
  precio_unitario: number
  resolucion: ResolucionLinea
}

export interface ResumenPedido {
  confirmadas: number
  totalLineas: number
  subtotal: number
  descuento: number
  iva: number
  total: number
}

function round2(valor: number): number {
  return Math.round(valor * 100) / 100
}

export function lineaReservable(linea: LineaCotizacion): boolean {
  if (linea.disponible === null) return false
  if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) return false
  return linea.disponible >= linea.cantidad
}

export function pedidoValido(pedido: { cliente_id: string; bodega_id: string; lineas: LineaCotizacion[] }): boolean {
  if (!esUuid(pedido.cliente_id) || !esUuid(pedido.bodega_id)) return false
  if (pedido.lineas.length < 1) return false
  return pedido.lineas.every((linea) => {
    if (!esUuid(linea.producto_id)) return false
    if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) return false
    if (linea.disponible === null) return false
    if (lineaReservable(linea)) return true
    return linea.resolucion === 'backorder'
  })
}

export function politicaDelFormulario(lineas: LineaCotizacion[]): PoliticaFaltantes {
  const hayBackorder = lineas.some((linea) => !lineaReservable(linea) && linea.resolucion === 'backorder')
  return hayBackorder ? 'backorder' : 'rechazar'
}

/** Misma cuenta que el backend: el descuento va antes del IVA y solo sobre las líneas reservables. */
export function resumenPedido(lineas: LineaCotizacion[], descuentoPct = 0): ResumenPedido {
  const incluidas = lineas.filter(lineaReservable)
  const subtotal = round2(incluidas.reduce((suma, linea) => suma + linea.cantidad * linea.precio_unitario, 0))
  const descuento = round2((subtotal * descuentoPct) / 100)
  const iva = round2(((subtotal - descuento) * IVA_PORCENTAJE) / 100)
  return {
    confirmadas: incluidas.length,
    totalLineas: lineas.length,
    subtotal,
    descuento,
    iva,
    total: round2(subtotal - descuento + iva),
  }
}

/** CU-01 A2: por encima del máximo hace falta un supervisor, salvo que quien vende ya sea administrador. */
export function requiereAutorizacion(descuentoPct: number, maximoPct: number, rol: string): boolean {
  return descuentoPct > maximoPct && rol !== 'administrador'
}

export function ajustarADisponible(linea: LineaCotizacion): LineaCotizacion {
  if (linea.disponible === null || linea.disponible < 1) return linea
  return { ...linea, cantidad: linea.disponible, resolucion: 'ajustada' }
}

export function dejarBackorder(linea: LineaCotizacion): LineaCotizacion {
  return { ...linea, resolucion: 'backorder' }
}
