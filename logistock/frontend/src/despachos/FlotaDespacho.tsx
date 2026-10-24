import { useState } from 'react'
import { Conductores, Vehiculos } from '../catalogo/Flota'
import { Encabezado } from '../navegacion/Encabezado'
import { MenuDespachos } from './MenuDespachos'

/** El jefe de logística registra su flota sin pasar por el catálogo del administrador. */
export function FlotaDespacho() {
  const [vista, setVista] = useState<'vehiculos' | 'conductores'>('vehiculos')
  return (
    <section className="pantalla">
      <Encabezado titulo="Flota">
        <MenuDespachos />
      </Encabezado>
      <nav className="subnav" aria-label="Flota">
        <button type="button" aria-pressed={vista === 'vehiculos'} onClick={() => setVista('vehiculos')}>Vehículos</button>
        <button type="button" aria-pressed={vista === 'conductores'} onClick={() => setVista('conductores')}>Conductores</button>
      </nav>
      {vista === 'vehiculos' ? <Vehiculos /> : <Conductores />}
    </section>
  )
}
