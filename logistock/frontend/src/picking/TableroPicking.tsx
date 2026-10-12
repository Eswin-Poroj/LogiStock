import { ConsultaGet } from '../api/ConsultaGet'
import { MenuPicking } from './MenuPicking'

export function TableroPicking() {
  return (
    <>
      <MenuPicking />
      <h1>Picking</h1>
      <ConsultaGet titulo="Tareas" ruta="/picking/tareas" />
    </>
  )
}
