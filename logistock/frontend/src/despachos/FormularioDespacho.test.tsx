import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, CONDUCTOR_ID, DESPACHO_ID, PEDIDO_ID, VEHICULO_ID } from '../test/ids'
import { textoDuracion } from './formatoRuta'

const OTRO_PEDIDO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const pedidosListos = [
  { id: PEDIDO_ID, numero: 'PED-000231', cliente: 'Ferretería El Tornillo', estado: 'en_preparacion', total: 7484.4, created_at: '2026-10-12T00:00:00.000Z' },
  { id: OTRO_PEDIDO, numero: 'PED-000230', cliente: 'Depósito San Pedro', estado: 'en_preparacion', total: 100, created_at: '2026-10-12T00:00:00.000Z' },
]

const rutaOk = {
  distancia_km: 182,
  duracion_min: 275,
  proveedor: 'osrm',
  paradas: [
    { orden: 1, pedido_id: PEDIDO_ID, cliente: 'Ferretería El Tornillo', direccion: 'Zona 1', eta: '08:40' },
    { orden: 2, pedido_id: OTRO_PEDIDO, cliente: 'Depósito San Pedro', direccion: 'Zona 2', eta: '09:25' },
  ],
}

function catalogos(url: string) {
  if (url.endsWith('/vehiculos')) return { status: 200, body: [{ id: VEHICULO_ID, nombre: 'Camión 02' }] }
  if (url.endsWith('/conductores')) return { status: 200, body: [{ id: CONDUCTOR_ID, nombre: 'Luis Hernández' }] }
  if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
  if (url.includes('/pedidos?estado=en_preparacion')) return { status: 200, body: pedidosListos }
  return null
}

async function elegirCatalogos() {
  const user = userEvent.setup()
  await screen.findByRole('option', { name: 'Camión 02' })
  await screen.findByRole('option', { name: 'Luis Hernández' })
  await screen.findByRole('option', { name: 'Bodega Central' })
  await user.selectOptions(screen.getByLabelText('Vehículo'), VEHICULO_ID)
  await user.selectOptions(screen.getByLabelText('Conductor'), CONDUCTOR_ID)
  await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
  return user
}

describe('formato de la ruta', () => {
  it('deja los minutos cortos en minutos', () => {
    expect(textoDuracion(40)).toBe('40 min')
  })
})

describe('planificar despacho', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('exige un pedido marcado y no pide el id en un textbox', async () => {
    redes.push(instalarFetch((url) => catalogos(url) ?? { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }))
    renderConSesion(<App />, 'despachador', '/despachos')
    expect(await screen.findByRole('heading', { name: 'Planificar despacho y ruta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asignar despacho' })).toBeDisabled()
    expect(screen.queryByRole('textbox', { name: 'Pedido' })).not.toBeInTheDocument()
    const user = await elegirCatalogos()
    expect(screen.getByRole('button', { name: 'Asignar despacho' })).toBeDisabled()
    await user.click(await screen.findByRole('checkbox', { name: /PED-000231/ }))
    expect(screen.getByRole('button', { name: 'Asignar despacho' })).toBeEnabled()
  })

  it('calcula y recalcula la ruta con los pedidos marcados', async () => {
    const red = instalarFetch((url) => {
      const catalogo = catalogos(url)
      if (catalogo) return catalogo
      if (url.endsWith('/despachos/calcular-ruta')) return { status: 200, body: rutaOk }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos')
    const user = await elegirCatalogos()
    await user.click(await screen.findByRole('checkbox', { name: /PED-000231/ }))
    await user.click(screen.getByRole('checkbox', { name: /PED-000230/ }))
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }))
    expect(await screen.findByText('182 km')).toBeInTheDocument()
    expect(screen.getByText('4 h 35 min')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Motor: osrm')).toBeInTheDocument()
    expect(screen.getByText('Ferretería El Tornillo')).toBeInTheDocument()
    expect(screen.getByText('08:40')).toBeInTheDocument()
    expect(screen.queryByText(/valores estimados de ejemplo/)).not.toBeInTheDocument()
    const primero = red.llamadas.find((llamada) => llamada.url.endsWith('/calcular-ruta'))
    expect(JSON.parse(String(primero?.init?.body))).toEqual({
      bodega_id: BODEGA_ID,
      pedido_ids: [PEDIDO_ID, OTRO_PEDIDO],
    })
    await user.click(screen.getByRole('button', { name: 'Recalcular ruta' }))
    expect(red.llamadas.filter((llamada) => llamada.url.endsWith('/calcular-ruta'))).toHaveLength(2)
  })

  it('con 502 no escribe distancia ni ETA y asigna sin eta', async () => {
    const red = instalarFetch((url, init) => {
      const catalogo = catalogos(url)
      if (catalogo) return catalogo
      if (url.endsWith('/despachos/calcular-ruta')) {
        return { status: 502, body: { statusCode: 502, message: 'El motor de rutas no respondió', error: 'Bad Gateway' } }
      }
      if (url.endsWith('/despachos') && init?.method === 'POST') {
        return { status: 201, body: { id: DESPACHO_ID, codigo: 'R-LOCAL', estado: 'planificado', vehiculo: 'Camión 02', conductor: 'Luis Hernández', paradas: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', orden: 1, pedido_id: PEDIDO_ID }] } }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos')
    const user = await elegirCatalogos()
    await user.click(await screen.findByRole('checkbox', { name: /PED-000231/ }))
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 502: El motor de rutas no respondió')
    expect(screen.queryByText('182 km')).not.toBeInTheDocument()
    expect(screen.queryByText('08:40')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Asignar despacho' }))
    expect(await screen.findByText('Despacho R-LOCAL')).toBeInTheDocument()
    expect(screen.getByText('Estado planificado')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/despachos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      vehiculo_id: VEHICULO_ID,
      conductor_id: CONDUCTOR_ID,
      bodega_id: BODEGA_ID,
      paradas: [{ pedido_id: PEDIDO_ID, orden: 1 }],
    })
  })

  it('copia orden y eta de la ruta al asignar', async () => {
    const red = instalarFetch((url, init) => {
      const catalogo = catalogos(url)
      if (catalogo) return catalogo
      if (url.endsWith('/despachos/calcular-ruta')) return { status: 200, body: rutaOk }
      if (url.endsWith('/despachos') && init?.method === 'POST') {
        return { status: 201, body: { id: DESPACHO_ID, codigo: 'R-LOCAL', estado: 'planificado', vehiculo: 'Camión 02', conductor: 'Luis Hernández', paradas: [] } }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos')
    const user = await elegirCatalogos()
    await user.click(await screen.findByRole('checkbox', { name: /PED-000231/ }))
    await user.click(screen.getByRole('checkbox', { name: /PED-000230/ }))
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }))
    await screen.findByText('182 km')
    await user.click(screen.getByRole('button', { name: 'Asignar despacho' }))
    expect(await screen.findByText('Despacho R-LOCAL')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/despachos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body)).paradas).toEqual([
      { pedido_id: PEDIDO_ID, orden: 1, eta: '08:40' },
      { pedido_id: OTRO_PEDIDO, orden: 2, eta: '09:25' },
    ])
  })
})
