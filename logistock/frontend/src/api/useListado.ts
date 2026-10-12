import { useEffect, useState } from 'react'
import { ApiError, api } from './cliente'

export function useListado<T>(ruta: string, token: string | null): { items: T[]; error: ApiError | null } {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => {
    if (!token) return
    let vivo = true
    api<T[]>(ruta, { token })
      .then((data) => {
        if (vivo) setItems(data)
      })
      .catch((fallo: unknown) => {
        if (vivo && fallo instanceof ApiError) setError(fallo)
      })
    return () => {
      vivo = false
    }
  }, [ruta, token])
  return { items, error }
}
