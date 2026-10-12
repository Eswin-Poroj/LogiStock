import type { ErrorCuerpo, LineaSinStock } from '../dominio/tipos'

export const API_BASE_LOCAL = 'http://127.0.0.1:3000/api/v1'
const PROYECTO_ALOJADO = 'lrjoozqkydvzptuzskjz'

export interface Solicitud {
  method?: 'GET' | 'POST'
  token?: string | null
  body?: unknown
}

type Cuerpo = ErrorCuerpo & { lineas_sin_stock?: LineaSinStock[] }

export class ApiError extends Error {
  readonly status: number
  readonly statusCode: number
  readonly detalle: string | string[]
  readonly lineasSinStock: LineaSinStock[] | null

  constructor(status: number, cuerpo: Cuerpo | null) {
    const detalle = cuerpo?.message ?? 'Error sin cuerpo'
    const texto = Array.isArray(detalle) ? detalle.join(' ') : detalle
    super(texto)
    this.name = 'ApiError'
    this.status = status
    this.statusCode = cuerpo?.statusCode ?? status
    this.detalle = detalle
    this.lineasSinStock = leerLineas(cuerpo)
  }
}

function leerLineas(cuerpo: Cuerpo | null): LineaSinStock[] | null {
  if (!cuerpo || !Array.isArray(cuerpo.lineas_sin_stock)) return null
  return cuerpo.lineas_sin_stock.map((fila) => ({
    producto_id: String(fila.producto_id),
    sku: String(fila.sku),
    solicitado: Number(fila.solicitado),
    disponible: Number(fila.disponible),
  }))
}

export function apiBase(configurada: string | undefined = import.meta.env.VITE_API_BASE): string {
  const base = (configurada && configurada.length > 0 ? configurada : API_BASE_LOCAL).replace(/\/$/, '')
  if (base.includes(PROYECTO_ALOJADO) || base !== API_BASE_LOCAL) {
    throw new Error(`VITE_API_BASE debe ser ${API_BASE_LOCAL}`)
  }
  return base
}

export function textoDe(error: ApiError): string {
  return `El servicio respondió ${error.status}: ${error.message}`
}

export async function api<T>(ruta: string, solicitud: Solicitud = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (solicitud.body !== undefined) headers['Content-Type'] = 'application/json'
  if (solicitud.token) headers.Authorization = `Bearer ${solicitud.token}`
  const respuesta = await fetch(`${apiBase()}${ruta}`, {
    method: solicitud.method ?? 'GET',
    headers,
    body: solicitud.body === undefined ? undefined : JSON.stringify(solicitud.body),
  })
  const texto = await respuesta.text()
  const json: unknown = texto ? JSON.parse(texto) : null
  if (!respuesta.ok) {
    const cuerpo = esCuerpo(json) ? json : null
    throw new ApiError(respuesta.status, cuerpo)
  }
  return json as T
}

function esCuerpo(valor: unknown): valor is Cuerpo {
  if (!valor || typeof valor !== 'object') return false
  const fila = valor as { statusCode?: unknown; message?: unknown }
  const mensajeOk =
    typeof fila.message === 'string' ||
    (Array.isArray(fila.message) && fila.message.every((item) => typeof item === 'string'))
  return typeof fila.statusCode === 'number' && mensajeOk
}
