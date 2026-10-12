import { describe, expect, it } from 'vitest'
import type { Rol } from '../dominio/tipos'
import { moduloDeRuta, modulosDe } from './modulos'

const VISIBLES: Record<Rol, string[]> = {
  administrador: ['Pedidos', 'Inventario', 'Picking', 'Despachos', 'Reportes'],
  asesor_ventas: ['Pedidos'],
  operario_bodega: ['Inventario', 'Picking'],
  despachador: ['Picking', 'Despachos'],
}

describe('módulos', () => {
  it('entrega solo las etiquetas del rol', () => {
    for (const rol of Object.keys(VISIBLES) as Rol[]) {
      expect(modulosDe(rol).map((modulo) => modulo.etiqueta)).toEqual(VISIBLES[rol])
    }
  })

  it('agrupa las subrutas en el módulo y deja fuera el login', () => {
    expect(moduloDeRuta('/inventario/ajustes')?.id).toBe('inventario')
    expect(moduloDeRuta('/despachos/nuevo')?.id).toBe('despachos')
    expect(moduloDeRuta('/picking/tarea')?.id).toBe('picking')
    expect(moduloDeRuta('/login')).toBeUndefined()
  })
})
