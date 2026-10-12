import { useState } from 'react'
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

  async function iniciar() {
    if (!token || !esUuid(despachoId)) return
    setError(null)
    setDespacho(null)
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
      <button type="button" disabled={!esUuid(despachoId)} onClick={() => void iniciar()}>Iniciar ruta</button>
      {despacho && <p>Estado {despacho.estado}</p>}
    </section>
  )
}
