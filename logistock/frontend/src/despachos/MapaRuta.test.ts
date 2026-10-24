import { describe, expect, it } from 'vitest'
import type { Ruta } from '../dominio/tipos'
import { horaDe } from './formatoRuta'
import { puntosDeRuta } from './MapaRuta'

const base: Ruta = {
  distancia_km: 30,
  duracion_min: 50,
  proveedor: 'osrm',
  origen: { nombre: 'Bodega Central', direccion: 'Zona 1', latitud: 14.8347, longitud: -91.5181 },
  paradas: [
    { orden: 1, pedido_id: 'a', cliente: 'Uno', direccion: 'Zona 3', latitud: 14.84, longitud: -91.52, eta: '2026-10-10T15:10:00.000Z' },
    { orden: 2, pedido_id: 'b', cliente: 'Dos', direccion: 'San Pedro', latitud: 14.96, longitud: -91.77, eta: '2026-10-10T15:50:00.000Z' },
  ],
}

describe('mapa de la ruta', () => {
  it('ordena bodega y paradas como pares latitud, longitud', () => {
    expect(puntosDeRuta(base)).toEqual({ origen: [14.8347, -91.5181], paradas: [[14.84, -91.52], [14.96, -91.77]] })
  })

  it('no inventa posiciones si falta una coordenada', () => {
    expect(puntosDeRuta({ ...base, origen: undefined })).toBeNull()
    expect(puntosDeRuta({ ...base, paradas: [{ ...base.paradas[0], latitud: undefined }] })).toBeNull()
  })

  it('muestra la ETA como hora y deja intacto lo que no es fecha', () => {
    expect(horaDe('08:40')).toBe('08:40')
    expect(horaDe('2026-10-10T15:10:00.000Z')).toMatch(/^\d{2}:\d{2}$/)
  })
})
