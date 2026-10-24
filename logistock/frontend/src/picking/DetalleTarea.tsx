import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'
import { useSesion } from '../auth/sesion'
import type { CompletarPicking, EscaneoNuevo, EstadoPicking, TareaPicking } from '../dominio/tipos'
import { esUuid } from '../dominio/uuid'

export function etiquetaEstadoPicking(estado: EstadoPicking): 'Pendiente' | 'En curso' | 'Completada' | 'Con faltante' {
  if (estado === 'pendiente') return 'Pendiente'
  if (estado === 'en_curso') return 'En curso'
  if (estado === 'completado') return 'Completada'
  return 'Con faltante'
}

const NOTA: Record<EstadoPicking, string> = {
  pendiente: 'El pedido sigue en Creado hasta el primer escaneo válido.',
  en_curso: 'El primer escaneo pasó el pedido a En preparación.',
  completado: 'La tarea está completa. El pedido sigue en En preparación hasta el despacho.',
  con_faltante: 'La tarea quedó con faltante. El sistema avisa al asesor de ventas.',
}

export function DetalleTarea({ tareaId, lectura, onActualizada, ranuraEscaneo = null }: {
  tareaId: string | null
  lectura: boolean
  onActualizada: (tarea: TareaPicking) => void
  /** Lugar del encabezado donde va el escaneo, como en la figura 7; si no hay, queda dentro de la tarjeta. */
  ranuraEscaneo?: HTMLElement | null
}) {
  const { token } = useSesion()
  const [tarea, setTarea] = useState<TareaPicking | null>(null)
  const [sku, setSku] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState<ApiError | null>(null)
  const lista = tarea && tarea.lineas.every((linea) => linea.cantidad_recogida >= linea.cantidad)
  // Solo se actúa sobre una tarea que la API devolvió y que sigue abierta.
  const abierta = tarea !== null && (tarea.estado === 'pendiente' || tarea.estado === 'en_curso')
  const campoSku = useRef<HTMLInputElement>(null)
  const pendientes = (tarea?.lineas ?? []).filter((linea) => linea.cantidad_recogida < linea.cantidad)
  const skuEscrito = sku.trim().toUpperCase()
  const lineaEscrita = tarea?.lineas.find((linea) => linea.sku.toUpperCase() === skuEscrito)
  const skuAjeno = skuEscrito !== '' && tarea !== null && !lineaEscrita

  useEffect(() => {
    setTarea(null)
    setError(null)
    if (!token || !tareaId || !esUuid(tareaId)) return
    let vivo = true
    api<TareaPicking>(`/picking/tareas/${tareaId}`, { token })
      .then((dato) => { if (vivo) setTarea(dato) })
      .catch((fallo: unknown) => { if (vivo && fallo instanceof ApiError) setError(fallo) })
    return () => { vivo = false }
  }, [token, tareaId])

  function aplicar(dato: TareaPicking) {
    setTarea(dato)
    onActualizada(dato)
  }

  async function escanear() {
    if (!token || !tarea || !abierta || sku.trim() === '' || !Number.isInteger(cantidad) || cantidad < 1) return
    setError(null)
    const body: EscaneoNuevo = { sku: lineaEscrita?.sku ?? sku.trim(), cantidad }
    try {
      aplicar(await api<TareaPicking>(`/picking/tareas/${tarea.id}/escaneos`, { method: 'POST', token, body }))
      setSku('')
      setCantidad(1)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  async function cerrar(faltante: boolean) {
    if (!token || !tarea || !abierta) return
    setError(null)
    const body: CompletarPicking = { faltante }
    try {
      aplicar(await api<TareaPicking>(`/picking/tareas/${tarea.id}/completar`, { method: 'POST', token, body }))
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  /** Prepara el escaneo de una línea: su SKU y lo que falta por recoger. */
  function recoger(skuLinea: string, faltan: number) {
    setSku(skuLinea)
    setCantidad(faltan)
    setError(null)
    campoSku.current?.focus()
  }

  if (!tareaId) return null
  if (!esUuid(tareaId)) return <p role="alert">Esa tarea no existe. Elige una de la lista o del tablero.</p>
  const escaneo = !lectura && abierta && (
    <div className="controles-escaneo">
      <label>
        <span className={ranuraEscaneo ? 'solo-lectores' : undefined}>SKU</span>
        <input
          ref={campoSku}
          list="skus-pendientes"
          placeholder="Escanear o escribir SKU"
          aria-describedby="ayuda-sku"
          value={sku}
          onChange={(evento) => setSku(evento.target.value)}
          onKeyDown={(evento) => { if (evento.key === 'Enter') { evento.preventDefault(); void escanear() } }}
        />
      </label>
      <datalist id="skus-pendientes">
        {pendientes.map((linea) => <option key={linea.pedido_linea_id} value={linea.sku}>{`${linea.nombre} · faltan ${linea.cantidad - linea.cantidad_recogida}`}</option>)}
      </datalist>
      <label><span className={ranuraEscaneo ? 'solo-lectores' : undefined}>Cantidad</span><input type="number" min={1} value={cantidad} onChange={(evento) => setCantidad(Number(evento.target.value))} /></label>
      <button type="button" className="boton-confirmar" onClick={() => void escanear()}>Confirmar escaneo</button>
    </div>
  )
  return (
    <section className="tarjeta detalle-tarea">
      {error && <AvisoApi error={error} />}
      {tarea && (
        <div className="tarjeta-titulo">
          <h2>{[tarea.numero_pedido, tarea.cliente].filter(Boolean).join(' · ') || 'Tarea de picking'}</h2>
          {tarea.operario && <p>Asignado a: {tarea.operario}</p>}
        </div>
      )}
      {tarea && <p className="estado-pedido">{etiquetaEstadoPicking(tarea.estado)}</p>}
      {tarea && <p className="nota">{NOTA[tarea.estado]}</p>}
      {abierta && !lectura && (
        <p className="nota" id="ayuda-sku" aria-live="polite">
          {skuAjeno
            ? <span className="texto-alerta">El SKU {skuEscrito} no está en esta tarea.</span>
            : lineaEscrita
              ? `${lineaEscrita.nombre}${lineaEscrita.ubicacion ? ` en ${lineaEscrita.ubicacion}` : ''}: faltan ${lineaEscrita.cantidad - lineaEscrita.cantidad_recogida}.`
              : 'Escanea la etiqueta del producto o pulsa Recoger en la línea que vas a tomar.'}
        </p>
      )}
      {tarea?.lineas.map((linea) => {
        const completa = linea.cantidad_recogida >= linea.cantidad
        return (
          <div className={completa ? 'linea-pick completa' : 'linea-pick'} key={linea.pedido_linea_id}>
            <span className="marca" aria-hidden="true">{completa ? '✓' : ''}</span>
            <span className="linea-texto">
              <strong>{linea.nombre}</strong>
              <span className="sku">{linea.sku}{linea.ubicacion ? ` · ${linea.ubicacion}` : ''}</span>
            </span>
            <span className="conteo">
              {linea.cantidad_recogida} / {linea.cantidad}
              {!completa && <small>faltan {linea.cantidad - linea.cantidad_recogida}</small>}
            </span>
            {abierta && !lectura && !completa && (
              <button type="button" aria-label={`Recoger ${linea.sku}`} onClick={() => recoger(linea.sku, linea.cantidad - linea.cantidad_recogida)}>Recoger</button>
            )}
          </div>
        )
      })}
      {escaneo && (ranuraEscaneo ? createPortal(escaneo, ranuraEscaneo) : escaneo)}
      {!lectura && abierta && (
        <div className="controles-escaneo">
          <button type="button" className="boton-alerta" onClick={() => void cerrar(true)}>Reportar faltante</button>
          <button type="button" className="boton-primario" disabled={!lista} onClick={() => void cerrar(false)}>Marcar como listo para despacho</button>
        </div>
      )}
    </section>
  )
}
