import { ConsultaGet } from '../api/ConsultaGet'
import { MenuDespachos } from './MenuDespachos'
import { Encabezado } from '../navegacion/Encabezado'

export function ListaDespachos() {
  return (
    <section className="pantalla pantalla-ficha">
      <Encabezado titulo="Seguimiento">
        <MenuDespachos />
      </Encabezado>
      <div className="ficha">
        <ConsultaGet titulo="Listado" ruta="/despachos" />
      </div>
    </section>
  )
}
