import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, CONDUCTOR_ID, DESPACHO_ID, PEDIDO_ID, VEHICULO_ID } from '../test/ids'

function catalogos(url: string) {
  if (url.endsWith('/vehiculos')) return { status: 200, body: [{ id: VEHICULO_ID, nombre: 'Camión 02' }] }
  if (url.endsWith('/conductores')) return { status: 200, body: [{ id: CONDUCTOR_ID, nombre: 'Luis' }] }
  if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
  return null
}

async function llenar() {
  const user = userEvent.setup()
  await screen.findByRole('option', { name: 'Camión 02' })
  await screen.findByRole('option', { name: 'Luis' })
  await screen.findByRole('option', { name: 'Bodega Central' })
  await user.selectOptions(screen.getByLabelText('Vehículo'), VEHICULO_ID)
  await user.selectOptions(screen.getByLabelText('Conductor'), CONDUCTOR_ID)
  await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
  fireEvent.change(screen.getByLabelText('Pedido'), { target: { value: PEDIDO_ID } })
  return user
}

describe('crear despacho', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('con 502 no escribe distancia ni ETA y crea el despacho sin eta', async () => {
    const red = instalarFetch((url, init) => {
      const catalogo = catalogos(url)
      if (catalogo) return catalogo
      if (url.endsWith('/despachos/calcular-ruta')) {
        return { status: 502, body: { statusCode: 502, message: 'El motor de rutas no respondió', error: 'Bad Gateway' } }
      }
      if (url.endsWith('/despachos') && init?.method === 'POST') {
        return { status: 201, body: { id: DESPACHO_ID, codigo: 'R-LOCAL', estado: 'planificado', vehiculo: 'Camión 02', conductor: 'Luis', paradas: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', orden: 1, pedido_id: PEDIDO_ID }] } }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/nuevo')
    const user = await llenar()
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 502: El motor de rutas no respondió')
    expect(screen.queryByText(/Distancia:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Duración:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/ETA /)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear despacho' }))
    expect(await screen.findByText('Despacho R-LOCAL')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/despachos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      vehiculo_id: VEHICULO_ID,
      conductor_id: CONDUCTOR_ID,
      bodega_id: BODEGA_ID,
      paradas: [{ pedido_id: PEDIDO_ID, orden: 1 }],
    })
  })

  it('con 200 copia distancia, duración y ETA del cuerpo', async () => {
    const red = instalarFetch((url) => {
      const catalogo = catalogos(url)
      if (catalogo) return catalogo
      if (url.endsWith('/despachos/calcular-ruta')) {
        return {
          status: 200,
          body: {
            distancia_km: 12.5,
            duracion_min: 40,
            proveedor: 'osrm',
            paradas: [{ orden: 1, pedido_id: PEDIDO_ID, cliente: 'Ferretería El Tornillo', direccion: 'Zona 1', eta: '2026-10-12T15:00:00.000Z' }],
          },
        }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/nuevo')
    const user = await llenar()
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }))
    expect(await screen.findByText('Distancia: 12.5 km')).toBeInTheDocument()
    expect(screen.getByText('Duración: 40 min')).toBeInTheDocument()
    expect(screen.getByText('ETA 2026-10-12T15:00:00.000Z')).toBeInTheDocument()
  })
})
