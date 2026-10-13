import { useSearchParams } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { accesoDe } from '../navegacion/modulos'
import { DetalleTarea } from './DetalleTarea'
import { MenuPicking } from './MenuPicking'

export function TareaPicking() {
  const { usuario } = useSesion()
  const [params] = useSearchParams()
  const id = params.get('id')
  const lectura = !usuario || accesoDe(usuario.rol, 'picking') !== 'escritura'
  return (
    <section>
      <MenuPicking />
      <h1>Tarea de picking</h1>
      {lectura && <p>Picking es de solo lectura para tu rol.</p>}
      <DetalleTarea tareaId={id} lectura={lectura} onActualizada={() => undefined} />
    </section>
  )
}
