import { esUuid } from '../dominio/uuid'
import type { PoliticaFaltantes } from '../dominio/tipos'

export interface LineaFormulario {
  producto_id: string
  cantidad: number
  disponible: number | null
}

export interface PedidoFormulario {
  cliente_id: string
  bodega_id: string
  politica_faltantes: PoliticaFaltantes
  lineas: LineaFormulario[]
}

export function lineaSinStock(disponible: number, cantidad: number): boolean {
  return disponible < cantidad
}

export function pedidoValido(pedido: PedidoFormulario): boolean {
  if (!esUuid(pedido.cliente_id) || !esUuid(pedido.bodega_id)) return false
  if (pedido.lineas.length < 1) return false
  return pedido.lineas.every((linea) => {
    if (!esUuid(linea.producto_id)) return false
    if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) return false
    if (linea.disponible === null) return false
    if (lineaSinStock(linea.disponible, linea.cantidad) && pedido.politica_faltantes !== 'backorder') return false
    return true
  })
}
