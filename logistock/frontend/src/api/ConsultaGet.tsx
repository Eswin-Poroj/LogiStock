import { useEffect, useState } from 'react'
import { useSesion } from '../auth/sesion'
import { AvisoApi } from './AvisoApi'
import { ApiError, api } from './cliente'

export function ConsultaGet({ titulo, ruta }: { titulo: string; ruta: string }) {
  const { token } = useSesion()
  const [error, setError] = useState<ApiError | null>(null)
  const [cuerpo, setCuerpo] = useState<unknown>(null)

  useEffect(() => {
    if (!token) return
    let vivo = true
    api<unknown>(ruta, { token })
      .then((data) => {
        if (vivo) setCuerpo(data)
      })
      .catch((fallo: unknown) => {
        if (vivo && fallo instanceof ApiError) setError(fallo)
      })
    return () => {
      vivo = false
    }
  }, [ruta, token])

  return (
    <section aria-label={titulo}>
      <h2>{titulo}</h2>
      {error && <AvisoApi error={error} />}
      {cuerpo !== null && <pre>{JSON.stringify(cuerpo)}</pre>}
    </section>
  )
}
