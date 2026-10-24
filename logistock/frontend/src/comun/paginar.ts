import { ApiError, api } from '../api/cliente'
import { useEffect, useMemo, useState } from 'react'

export const POR_PAGINA = 10

export function paginar<T>(items: T[], pagina: number, porPagina = POR_PAGINA): { visibles: T[]; paginas: number; pagina: number } {
  const paginas = Math.max(1, Math.ceil(items.length / porPagina))
  const actual = Math.min(Math.max(1, pagina), paginas)
  return { visibles: items.slice((actual - 1) * porPagina, actual * porPagina), paginas, pagina: actual }
}

/** Filtra por texto y pagina en el cliente; al cambiar la búsqueda vuelve a la página 1. */
export function useTablaPaginada<T>(items: T[], textoDe: (item: T) => string, porPagina = POR_PAGINA) {
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  useEffect(() => { setPagina(1) }, [busqueda])
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return q ? items.filter((item) => textoDe(item).toLowerCase().includes(q)) : items
  }, [busqueda, items, textoDe])
  const resultado = paginar(filtrados, pagina, porPagina)
  return { busqueda, setBusqueda, ...resultado, setPagina, total: filtrados.length }
}

/** Confirmación nativa: simple, accesible y fácil de simular en pruebas. */
export function confirmar(mensaje: string): boolean {
  return window.confirm(mensaje)
}

/**
 * Pide confirmación y borra. Devuelve true si se borró; si la API lo rechaza (409 por historial),
 * entrega el error para mostrarlo junto a la tabla.
 */
export async function eliminarConConfirmacion(token: string | null, ruta: string, pregunta: string, onError: (error: ApiError) => void): Promise<boolean> {
  if (!token || !confirmar(pregunta)) return false
  try {
    await api<null>(ruta, { method: 'DELETE', token })
    return true
  } catch (fallo) {
    if (!(fallo instanceof ApiError)) throw fallo
    onError(fallo)
    return false
  }
}
