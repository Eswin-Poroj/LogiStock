import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { accesoDe } from '../navegacion/modulos'
import { DetalleTarea } from './DetalleTarea'
import { MenuPicking } from './MenuPicking'

export function TareaPicking() {
  const { usuario } = useSesion()
  const [params, setParams] = useSearchParams()
  const id = params.get('id')
  const [tareaEscrita, setTareaEscrita] = useState('')
  const lectura = !usuario || accesoDe(usuario.rol, 'picking') !== 'escritura'

  function abrir(evento: FormEvent) {
    evento.preventDefault()
    const valor = tareaEscrita.trim()
    if (valor === '') return
    setParams({ id: valor })
  }

  return (
    <section>
      <MenuPicking />
      <h1>Tarea de picking</h1>
      {lectura && <p>Picking es de solo lectura para tu rol.</p>}
      {!id && (
        <form onSubmit={abrir}>
          <p>Elige una tarea en el tablero.</p>
          <label>
            Tarea
            <input value={tareaEscrita} onChange={(evento) => setTareaEscrita(evento.target.value)} />
          </label>
          <button type="submit">Abrir</button>
        </form>
      )}
      <DetalleTarea tareaId={id} lectura={lectura} onActualizada={() => undefined} />
    </section>
  )
}
