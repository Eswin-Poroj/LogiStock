import { describe, expect, it } from 'vitest'
import type { Rol } from '../dominio/tipos'
import { accesoDe, moduloDeRuta, modulosDe } from './modulos'

const VISIBLES: Record<Rol, string[]> = {
  administrador: ['Pedidos', 'Inventario', 'Picking', 'Despacho', 'Reportes'],
  asesor_ventas: ['Pedidos', 'Inventario'],
  operario_bodega: ['Inventario', 'Picking'],
  despachador: ['Picking', 'Despacho'],
}

describe('módulos', () => {
  it('entrega solo las etiquetas del rol', () => {
    for (const rol of Object.keys(VISIBLES) as Rol[]) {
      expect(modulosDe(rol).map((modulo) => modulo.etiqueta)).toEqual(VISIBLES[rol])
    }
  })

  it('marca inventario del asesor y picking del despachador como lectura', () => {
    expect(accesoDe('asesor_ventas', 'inventario')).toBe('lectura')
    expect(accesoDe('asesor_ventas', 'pedidos')).toBe('escritura')
    expect(accesoDe('asesor_ventas', 'reportes')).toBe('ninguno')
    expect(accesoDe('despachador', 'picking')).toBe('lectura')
    expect(accesoDe('despachador', 'despachos')).toBe('escritura')
    expect(accesoDe('operario_bodega', 'picking')).toBe('escritura')
    expect(accesoDe('administrador', 'reportes')).toBe('escritura')
  })

  it('agrupa las subrutas en el módulo y deja fuera el login', () => {
    expect(moduloDeRuta('/inventario/ajustes')?.id).toBe('inventario')
    expect(moduloDeRuta('/despachos/nuevo')?.id).toBe('despachos')
    expect(moduloDeRuta('/picking/tarea')?.id).toBe('picking')
    expect(moduloDeRuta('/login')).toBeUndefined()
  })
})
