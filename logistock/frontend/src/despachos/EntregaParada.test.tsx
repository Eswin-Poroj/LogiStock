import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { DESPACHO_ID, PARADA_ID, PEDIDO_ID } from '../test/ids'

const parada = { id: PARADA_ID, orden: 1, pedido_id: PEDIDO_ID, numero_pedido: 'PED-000231', cliente: 'Ferretería El Tornillo', direccion: 'Zona 1', eta: '2026-10-12T14:40:00.000Z' }
const base = { id: DESPACHO_ID, codigo: 'R-14', vehiculo: 'Camión 02', conductor: 'Luis', paradas: [parada] }
const planificado = { ...base, estado: 'planificado' }
const enRuta = { ...base, estado: 'en_ruta' }
const finalizado = { ...base, estado: 'finalizado', paradas: [{ ...parada, entregada_at: '2026-10-12T18:00:00.000Z' }] }

describe('iniciar ruta', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('elige la ruta planificada de la lista, la inicia y queda En ruta', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/despachos?estado=planificado')) return { status: 200, body: [planificado] }
      if (url.endsWith(`/despachos/${DESPACHO_ID}/iniciar`) && init?.method === 'POST') return { status: 200, body: enRuta }
      return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/iniciar')
    expect(screen.queryByRole('textbox', { name: 'Despacho' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Despacho'), await screen.findByRole('option', { name: 'R-14 · Luis · 1 paradas' }))
    expect(screen.getByText('Ferretería El Tornillo')).toBeInTheDocument()
    expect(screen.getByText('Planificado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Iniciar ruta' }))
    expect(await screen.findByText('En ruta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a confirmar entregas' })).toHaveAttribute('href', `/despachos/entrega?id=${DESPACHO_ID}`)
  })

  it('muestra el 409 si la ruta ya no está planificada', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((_url, init) => {
      if (init?.method === 'POST') return { status: 409, body: { statusCode: 409, message: 'El despacho está en_ruta; solo se inicia una ruta planificada', error: 'Conflict' } }
      return { status: 200, body: [planificado] }
    }))
    renderConSesion(<App />, 'despachador', '/despachos/iniciar')
    await user.selectOptions(screen.getByLabelText('Despacho'), await screen.findByRole('option', { name: 'R-14 · Luis · 1 paradas' }))
    await user.click(screen.getByRole('button', { name: 'Iniciar ruta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: El despacho está en_ruta')
  })
})

describe('entrega', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('abre la ruta del enlace y confirma la última parada', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/despachos?estado=en_ruta')) return { status: 200, body: [enRuta] }
      if (url.endsWith(`/despachos/${DESPACHO_ID}/paradas/${PARADA_ID}/entregar`) && init?.method === 'POST') return { status: 200, body: finalizado }
      return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', `/despachos/entrega?id=${DESPACHO_ID}`)
    expect(await screen.findByText('Ferretería El Tornillo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Despacho finalizado')).toBeInTheDocument()
    expect(screen.getByText('Finalizado')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText(/^Entregada /)).toBeInTheDocument()
  })

  it('muestra el 409 y no escribe una hora de entrega', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((_url, init) => {
      if (!init?.method || init.method === 'GET') return { status: 200, body: [enRuta] }
      return { status: 409, body: { statusCode: 409, message: 'Parada ya entregada', error: 'Conflict' } }
    }))
    renderConSesion(<App />, 'despachador', '/despachos/entrega')
    await user.selectOptions(screen.getByLabelText('Despacho'), await screen.findByRole('option', { name: 'R-14 · Luis · 0 de 1 entregadas' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: Parada ya entregada')
    expect(screen.queryByText(/^Entregada /)).not.toBeInTheDocument()
  })
})

describe('seguimiento', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('lista los despachos e inicia una ruta planificada desde la tabla', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/despachos')) return { status: 200, body: [{ ...planificado, distancia_km: 12.5, duracion_min: 40 }] }
      if (url.endsWith(`/despachos/${DESPACHO_ID}/iniciar`) && init?.method === 'POST') return { status: 200, body: enRuta }
      return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/seguimiento')
    expect(await screen.findByText('R-14')).toBeInTheDocument()
    expect(screen.getByText('0 de 1')).toBeInTheDocument()
    expect(screen.getByText(/12.5 km/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Iniciar ruta R-14' }))
    expect(await screen.findByRole('link', { name: 'Confirmar entregas' })).toHaveAttribute('href', `/despachos/entrega?id=${DESPACHO_ID}`)
  })
})
