import { describe, expect, it } from 'vitest'
import { migasDe } from './migas'

describe('migas', () => {
  it('usa los prefijos del mockup', () => {
    expect(migasDe('/pedidos')).toBe('Ventas / Pedidos / Nuevo')
    expect(migasDe('/pedidos/99999999-9999-4999-8999-999999999999')).toBe('Ventas / Pedidos / Detalle')
    expect(migasDe('/inventario')).toBe('Almacén / Inventario')
    expect(migasDe('/inventario/entradas')).toBe('Almacén / Inventario / Entrada')
    expect(migasDe('/inventario/ajustes')).toBe('Almacén / Inventario / Ajuste')
    expect(migasDe('/inventario/danio')).toBe('Almacén / Inventario / Daño')
    expect(migasDe('/picking')).toBe('Operaciones / Picking')
    expect(migasDe('/picking/tarea')).toBe('Operaciones / Picking / Tarea')
    expect(migasDe('/despachos')).toBe('Operaciones / Despacho')
    expect(migasDe('/despachos/seguimiento')).toBe('Operaciones / Despacho / Seguimiento')
    expect(migasDe('/despachos/iniciar')).toBe('Operaciones / Despacho / Iniciar')
    expect(migasDe('/despachos/entrega')).toBe('Operaciones / Despacho / Entrega')
    expect(migasDe('/reportes')).toBe('Gestión / Reportes')
  })
})
