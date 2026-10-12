import { describe, expect, it } from 'vitest'
import { esRol } from './tipos'
import { esUuid } from './uuid'
import { BODEGA_ID } from '../test/ids'

describe('dominio', () => {
  it('reconoce los cuatro roles del esquema', () => {
    expect(esRol('administrador')).toBe(true)
    expect(esRol('asesor_ventas')).toBe(true)
    expect(esRol('operario_bodega')).toBe(true)
    expect(esRol('despachador')).toBe(true)
    expect(esRol('invitado')).toBe(false)
  })

  it('reconoce un UUID de las pruebas y rechaza un texto', () => {
    expect(esUuid(BODEGA_ID)).toBe(true)
    expect(esUuid('no-es-uuid')).toBe(false)
  })
})
