import { useEffect, useState } from 'react'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { Despacho } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'
import { MenuDespachos } from './MenuDespachos'

export function EntregaParada() {
  const { token } = useSesion()
  const [despachoId, setDespachoId] = useState('')
  const [despacho, setDespacho] = useState<Despacho | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!token || !esUuid(despachoId)) return
    let vivo = true
    api<Despacho>(`/despachos/${despachoId}`, { token })
      .then((dato) => { if (vivo) setDespacho(dato) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [despachoId, token])

  async function entregar(paradaId: string) {
    if (!token || !esUuid(despachoId) || !esUuid(paradaId)) return
    setError(null)
    try {
      setDespacho(await api<Despacho>(`/despachos/${despachoId}/paradas/${paradaId}/entregar`, { method: 'POST', token }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  const pendientes = despacho?.paradas.filter((parada) => !parada.entregada_at) ?? []

  return (
    <section className="pantalla">
      <MenuDespachos />
      <h1>Entrega</h1>
      {error && <AvisoApi error={error} />}
      <label>
        Despacho
        <input value={despachoId} onChange={(evento) => setDespachoId(evento.target.value)} />
      </label>
      {pendientes.map((parada) => (
        <button className="boton-confirmar" key={parada.id} type="button" onClick={() => void entregar(parada.id)}>
          {pendientes.length === 1 ? 'Confirmar entrega' : `Confirmar entrega ${parada.orden}`}
        </button>
      ))}
      {despacho && <p>Despacho {despacho.codigo}</p>}
      {despacho && <p>Estado {despacho.estado}</p>}
      {despacho?.estado === 'finalizado' && <p className="nota-ok">Despacho finalizado</p>}
      {despacho?.paradas.map((parada) => parada.entregada_at ? <p key={parada.id}>Entregada {parada.entregada_at}</p> : <p key={parada.id}>Parada {parada.orden}</p>)}
    </section>
  )
}
