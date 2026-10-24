import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../api/cliente'
import type { Despacho, EstadoDespacho } from '../dominio/tipos'

/** Lista de despachos de la API, opcionalmente filtrada por estado. */
export function useDespachos(token: string | null, estado?: EstadoDespacho) {
  const [items, setItems] = useState<Despacho[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  const [cargando, setCargando] = useState(true)
  const ruta = estado ? `/despachos?estado=${estado}` : '/despachos'

  const recargar = useCallback(async () => {
    if (!token) return
    setCargando(true)
    try {
      const filas = await api<Despacho[]>(ruta, { token })
      setItems(Array.isArray(filas) ? filas : [])
      setError(null)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    } finally {
      setCargando(false)
    }
  }, [ruta, token])

  useEffect(() => { void recargar() }, [recargar])

  return { items, setItems, error, cargando, recargar }
}
