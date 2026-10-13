import { describe, expect, it } from 'vitest'
import { csvConBom } from './csv'

describe('csv', () => {
  it('escribe BOM y escapa comillas', () => {
    expect(csvConBom([['SKU', 'Producto'], ['FER-0012', 'Cemento, "gris"']])).toBe(
      '\uFEFFSKU,Producto\nFER-0012,"Cemento, ""gris"""',
    )
  })
})
