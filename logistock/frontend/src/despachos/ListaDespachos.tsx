import { ConsultaGet } from '../api/ConsultaGet'
import { MenuDespachos } from './MenuDespachos'

export function ListaDespachos() {
  return (
    <>
      <MenuDespachos />
      <h1>Despachos</h1>
      <ConsultaGet titulo="Listado" ruta="/despachos" />
    </>
  )
}
