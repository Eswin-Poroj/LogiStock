import { ConsultaGet } from '../api/ConsultaGet'
import { MenuDespachos } from './MenuDespachos'

export function ListaDespachos() {
  return (
    <section className="pantalla">
      <MenuDespachos />
      <h1>Seguimiento</h1>
      <ConsultaGet titulo="Listado" ruta="/despachos" />
    </section>
  )
}
