import { ConsultaGet } from '../api/ConsultaGet'

export function Reportes() {
  return (
    <>
      <h1>Reportes</h1>
      <ConsultaGet titulo="Resumen" ruta="/reportes/resumen" />
      <ConsultaGet titulo="Más vendidos" ruta="/reportes/mas-vendidos" />
      <ConsultaGet titulo="Alertas de stock" ruta="/reportes/alertas-stock" />
    </>
  )
}
