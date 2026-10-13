import { describe, expect, it } from 'vitest'
import { INICIO_POR_ROL, etiquetaRol } from './roles'

describe('roles de navegación', () => {
  it('traduce el rol técnico a la etiqueta del mockup', () => {
    expect(etiquetaRol('asesor_ventas')).toBe('Asesor de ventas')
    expect(etiquetaRol('operario_bodega')).toBe('Operario de bodega')
    expect(etiquetaRol('despachador')).toBe('Despachador')
    expect(etiquetaRol('administrador')).toBe('Administrador')
  })

  it('abre la pantalla inicial de la sección 2.12', () => {
    expect(INICIO_POR_ROL.asesor_ventas).toBe('/pedidos')
    expect(INICIO_POR_ROL.operario_bodega).toBe('/picking')
    expect(INICIO_POR_ROL.despachador).toBe('/despachos')
    expect(INICIO_POR_ROL.administrador).toBe('/reportes')
  })
})
