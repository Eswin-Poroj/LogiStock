import { useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'

export function EntregaParada() {
  const { token } = useSesion()
  const [despachoId, setDespachoId] = useState('')
  const [paradaId, setParadaId] = useState('')
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const listo = esUuid(despachoId) && esUuid(paradaId)

  async function entregar() {
    if (!token || !listo) return
    setError(null)
    setDespacho(null)
    try {
      setDespacho(await api<Despacho>(`/despachos/${despachoId}/paradas/${paradaId}/entregar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <section>
      <MenuDespachos />
      <h1>Entrega</h1>
      {error && <AvisoApi error={error} />}
      <label>
        Despacho
        <input value={despachoId} onChange={(evento) => setDespachoId(evento.target.value)} />
      </label>
      <label>
        Parada
        <input value={paradaId} onChange={(evento) => setParadaId(evento.target.value)} />
      </label>
      <button type="button" disabled={!listo} onClick={() => void entregar()}>Confirmar entrega</button>
      {despacho && <p>Despacho {despacho.codigo}</p>}
      {despacho && <p>Estado {despacho.estado}</p>}
      {despacho?.paradas.map((parada) => parada.entregada_at ? <p key={parada.id}>Entregada {parada.entregada_at}</p> : null)}
    </section>
  )
}
