/** Geocodificación con Nominatim (OpenStreetMap): sin llave, uso ligero y solo a pedido del usuario. */
const NOMINATIM = 'https://nominatim.openstreetmap.org'

export interface Lugar {
  etiqueta: string
  latitud: number
  longitud: number
  direccion: string
  municipio: string
}

interface RespuestaNominatim {
  display_name: string
  lat: string
  lon: string
  address?: Record<string, string>
}

/** Redondea a 6 decimales, lo que guarda la columna numeric(9,6). */
export function seisDecimales(valor: number): number {
  return Math.round(valor * 1e6) / 1e6
}

export function aLugar(fila: RespuestaNominatim): Lugar {
  const a = fila.address ?? {}
  const calle = [a.road, a.house_number].filter(Boolean).join(' ')
  const zona = a.suburb ?? a.neighbourhood ?? a.quarter ?? ''
  const municipio = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? ''
  return {
    etiqueta: fila.display_name,
    latitud: seisDecimales(Number(fila.lat)),
    longitud: seisDecimales(Number(fila.lon)),
    direccion: [calle, zona].filter(Boolean).join(', ') || fila.display_name.split(',').slice(0, 2).join(',').trim(),
    municipio,
  }
}

export async function buscarDireccion(texto: string): Promise<Lugar[]> {
  const params = new URLSearchParams({ q: texto, format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'gt', 'accept-language': 'es' })
  const respuesta = await fetch(`${NOMINATIM}/search?${params}`)
  if (!respuesta.ok) throw new Error(`El buscador de direcciones respondió ${respuesta.status}`)
  const filas = (await respuesta.json()) as RespuestaNominatim[]
  return filas.map(aLugar)
}

export async function direccionDe(latitud: number, longitud: number): Promise<Lugar | null> {
  const params = new URLSearchParams({ lat: String(latitud), lon: String(longitud), format: 'jsonv2', addressdetails: '1', 'accept-language': 'es' })
  const respuesta = await fetch(`${NOMINATIM}/reverse?${params}`)
  if (!respuesta.ok) return null
  const fila = (await respuesta.json()) as RespuestaNominatim & { error?: string }
  return fila.error ? null : { ...aLugar(fila), latitud, longitud }
}
