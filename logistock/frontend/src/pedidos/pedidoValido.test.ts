import { describe, expect, it } from 'vitest'
import { quetzales } from '../dominio/quetzales'
import { BODEGA_ID, CLIENTE_ID, PRODUCTO_ID } from '../test/ids'
import {
  IVA_PORCENTAJE,
  ajustarADisponible,
  dejarBackorder,
  lineaReservable,
  lineaSinStock,
  pedidoValido,
  politicaDelFormulario,
  resumenPedido,
} from './pedidoValido'
import type { LineaCotizacion } from './pedidoValido'

function linea(parcial: Partial<LineaCotizacion> = {}): LineaCotizacion {
  return {
    producto_id: PRODUCTO_ID,
    sku: 'FER-0012',
    nombre: 'Cemento gris 42.5 kg',
    cantidad: 1,
    disponible: 10,
    precio_unitario: 78,
    resolucion: 'pendiente',
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
    expect(pedidoValido({ cliente_id: '', bodega_id: BODEGA_ID, lineas: [] })).toBe(false)
    expect(pedidoValido({ cliente_id: CLIENTE_ID, bodega_id: BODEGA_ID, lineas: [linea({ cantidad: 0 })] })).toBe(false)
    expect(pedidoValido({ cliente_id: CLIENTE_ID, bodega_id: BODEGA_ID, lineas: [linea({ disponible: null })] })).toBe(false)
  })

  it('deja inválida una línea corta que sigue pendiente', () => {
    expect(pedidoValido({ cliente_id: CLIENTE_ID, bodega_id: BODEGA_ID, lineas: [linea({ disponible: 0 })] })).toBe(false)
  })

  it('acepta esa línea cuando su resolución es backorder', () => {
    expect(pedidoValido({
      cliente_id: CLIENTE_ID,
      bodega_id: BODEGA_ID,
      lineas: [linea({ disponible: 0, resolucion: 'backorder' })],
    })).toBe(true)
  })

  it('exige stock en todas las líneas si ninguna está en backorder', () => {
    expect(pedidoValido({
      cliente_id: CLIENTE_ID,
      bodega_id: BODEGA_ID,
      lineas: [linea(), linea({ cantidad: 5, disponible: 3 })],
    })).toBe(false)
  })

  it('acepta una línea cubierta', () => {
    expect(pedidoValido({ cliente_id: CLIENTE_ID, bodega_id: BODEGA_ID, lineas: [linea()] })).toBe(true)
  })
})

describe('cotización del mockup', () => {
  it('deja fuera del total la línea sin stock', () => {
    const corta = linea({ sku: 'PIN-0207', nombre: 'Pintura látex', cantidad: 60, disponible: 18, precio_unitario: 215 })
    const sana = linea({ cantidad: 40, disponible: 312, precio_unitario: 78 })
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
    const ajustada = ajustarADisponible(linea({ sku: 'PIN-0207', cantidad: 60, disponible: 18, precio_unitario: 215 }))
    expect(ajustada.cantidad).toBe(18)
    expect(ajustada.resolucion).toBe('ajustada')
    expect(lineaReservable(ajustada)).toBe(true)
    const agotada = ajustarADisponible(linea({ disponible: 0, cantidad: 4 }))
    expect(agotada.cantidad).toBe(4)
    expect(agotada.resolucion).toBe('pendiente')
  })

  it('el backorder de una línea pone la política del pedido en backorder', () => {
    const back = dejarBackorder(linea({ disponible: 0, cantidad: 1 }))
    expect(back.resolucion).toBe('backorder')
    expect(politicaDelFormulario([back])).toBe('backorder')
    expect(resumenPedido([back]).subtotal).toBe(0)
    expect(politicaDelFormulario([linea()])).toBe('rechazar')
  })

  it('formatea quetzales como el mockup', () => {
    expect(quetzales(7484.4)).toBe('Q 7,484.40')
    expect(quetzales(78)).toBe('Q 78.00')
  })
})
