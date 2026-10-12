import { describe, expect, it } from 'vitest'
import { BODEGA_ID, CLIENTE_ID, PRODUCTO_ID } from '../test/ids'
import { lineaSinStock, pedidoValido } from './pedidoValido'
import type { PedidoFormulario } from './pedidoValido'

function pedido(parcial: Partial<PedidoFormulario> = {}): PedidoFormulario {
  return {
    cliente_id: CLIENTE_ID,
    bodega_id: BODEGA_ID,
    politica_faltantes: 'rechazar',
    lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1, disponible: 10 }],
    ...parcial,
  }
}

describe('pedido válido', () => {
  it('marca sin stock cuando lo pedido supera lo disponible', () => {
    expect(lineaSinStock(0, 1)).toBe(true)
    expect(lineaSinStock(3, 5)).toBe(true)
    expect(lineaSinStock(2, 2)).toBe(false)
  })

  it('rechaza el formulario vacío, la cantidad cero y el disponible desconocido', () => {
    expect(pedidoValido(pedido({ cliente_id: '', lineas: [] }))).toBe(false)
    expect(pedidoValido(pedido({ lineas: [{ producto_id: PRODUCTO_ID, cantidad: 0, disponible: 10 }] }))).toBe(false)
    expect(pedidoValido(pedido({ lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1, disponible: null }] }))).toBe(false)
  })

  it('con rechazar, una línea sin stock deja el pedido inválido', () => {
    expect(pedidoValido(pedido({ lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1, disponible: 0 }] }))).toBe(false)
  })

  it('con backorder, la misma línea es válida', () => {
    expect(pedidoValido(pedido({
      politica_faltantes: 'backorder',
      lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1, disponible: 0 }],
    }))).toBe(true)
  })

  it('exige stock en todas las líneas si la política es rechazar', () => {
    expect(pedidoValido(pedido({
      lineas: [
        { producto_id: PRODUCTO_ID, cantidad: 1, disponible: 10 },
        { producto_id: PRODUCTO_ID, cantidad: 5, disponible: 3 },
      ],
    }))).toBe(false)
  })

  it('acepta una línea cubierta', () => {
    expect(pedidoValido(pedido())).toBe(true)
  })
})
