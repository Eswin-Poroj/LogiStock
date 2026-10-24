import { describe, expect, it } from 'vitest'
import { aLugar, seisDecimales } from './geocodificar'
import { prefijoDe } from './Catalogo'

describe('geocodificar', () => {
  it('arma dirección y municipio con lo que devuelve Nominatim', () => {
    const lugar = aLugar({ display_name: 'X', lat: '14.83470012', lon: '-91.51810049', address: { road: '4a Calle', house_number: '12-30', suburb: 'Zona 1', town: 'Salcajá' } })
    expect(lugar).toMatchObject({ latitud: 14.8347, longitud: -91.5181, direccion: '4a Calle 12-30, Zona 1', municipio: 'Salcajá' })
  })

  it('sin calle usa el inicio del nombre completo', () => {
    expect(aLugar({ display_name: 'Parque Central, Quetzaltenango, Guatemala', lat: '1', lon: '2' }).direccion).toBe('Parque Central, Quetzaltenango')
  })

  it('redondea a los 6 decimales que guarda la base', () => {
    expect(seisDecimales(14.83470049)).toBe(14.8347)
  })
})

describe('prefijo del SKU', () => {
  it('coincide con la regla del backend', () => {
    expect(prefijoDe('Ferretería')).toBe('FER')
    expect(prefijoDe('x')).toBe('PRD')
  })
})
