import { describe, expect, it } from 'vitest'
import { BODEGA_ID, CLIENTE_ID, PRODUCTO_ID } from '../test/ids'
import { IVA_PORCENTAJE, ajustarADisponible, dejarBackorder, lineaReservable, lineaSinStock, pedidoValido, politicaDelFormulario, resumenPedido } from './pedidoValido'
import type { LineaCotizacion, PedidoFormulario } from './pedidoValido'
import { quetzales } from '../dominio/quetzales'

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

function cotizacion(parcial: Partial<LineaCotizacion> = {}): LineaCotizacion {
  return {
    producto_id: PRODUCTO_ID,
    sku: 'PIN-0207',
    nombre: 'Pintura látex',
    cantidad: 60,
    disponible: 18,
    precio_unitario: 215,
    resolucion: 'pendiente',
    ...parcial,
  }
}

describe('cotización del mockup', () => {
  it('deja fuera del total la línea sin stock', () => {
    const corta = cotizacion()
    const sana = cotizacion({
      producto_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      sku: 'FER-0012',
      cantidad: 40,
      disponible: 312,
      precio_unitario: 78,
    })
    expect(lineaReservable(corta)).toBe(false)
    expect(lineaReservable(sana)).toBe(true)
    const resumen = resumenPedido([sana, corta])
    expect(resumen.confirmadas).toBe(1)
    expect(resumen.totalLineas).toBe(2)
    expect(resumen.subtotal).toBe(3120)
    expect(resumen.iva).toBe(374.4)
    expect(resumen.total).toBe(3494.4)
    expect(IVA_PORCENTAJE).toBe(12)
  })

  it('ajustar a disponible deja la línea reservable y no baja de 1', () => {
    const ajustada = ajustarADisponible(cotizacion())
    expect(ajustada.cantidad).toBe(18)
    expect(ajustada.resolucion).toBe('ajustada')
    expect(lineaReservable(ajustada)).toBe(true)
    const agotada = ajustarADisponible(cotizacion({ disponible: 0, cantidad: 4 }))
    expect(agotada.cantidad).toBe(4)
    expect(agotada.resolucion).toBe('pendiente')
  })

  it('el backorder de una línea pone la política del pedido en backorder', () => {
    const linea = dejarBackorder(cotizacion({ disponible: 0, cantidad: 1 }))
    expect(linea.resolucion).toBe('backorder')
    expect(politicaDelFormulario([linea])).toBe('backorder')
    expect(resumenPedido([linea]).subtotal).toBe(0)
    expect(politicaDelFormulario([cotizacion({ cantidad: 1, disponible: 10 })])).toBe('rechazar')
  })

  it('formatea quetzales como el mockup', () => {
    expect(quetzales(7484.4)).toBe('Q 7,484.40')
    expect(quetzales(78)).toBe('Q 78.00')
  })
})
