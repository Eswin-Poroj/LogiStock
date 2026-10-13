import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'

export function IniciarDespacho() {
  const { token } = useSesion()
  const [despachoId, setDespachoId] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [despacho, setDespacho] = useState<Despacho | null>(null)

  useEffect(() => {
    if (!token || !esUuid(despachoId)) return
    let vivo = true
    api<Despacho>(`/despachos/${despachoId}`, { token })
      .then((dato) => { if (vivo) setDespacho(dato) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [despachoId, token])

  async function iniciar() {
    if (!token || !esUuid(despachoId)) return
    setError(null)
    try {
      setDespacho(await api<Despacho>(`/despachos/${despachoId}/iniciar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <MenuDespachos />
      <h1>Iniciar despacho</h1>
      {error && <AvisoApi error={error} />}
      <label>
        Despacho
        <input value={despachoId} onChange={(evento) => setDespachoId(evento.target.value)} />
      </label>
      {despacho?.paradas.map((parada) => <p key={parada.id}>Parada {parada.orden}</p>)}
      {despacho && <p>Estado {despacho.estado}</p>}
      <button type="button" disabled={!esUuid(despachoId)} onClick={() => void iniciar()}>Iniciar ruta</button>
    </section>
  )
}
