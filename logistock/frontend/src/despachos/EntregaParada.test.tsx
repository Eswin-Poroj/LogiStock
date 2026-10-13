import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { DESPACHO_ID, PARADA_ID, PEDIDO_ID } from '../test/ids'

const despachoPendiente = {
  id: DESPACHO_ID,
  codigo: 'R-14',
  estado: 'planificado',
  vehiculo: 'Camión 02',
  conductor: 'Luis',
  paradas: [{ id: PARADA_ID, orden: 1, pedido_id: PEDIDO_ID, eta: '08:40' }],
}

describe('entrega', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('confirma la parada que devolvió el despacho', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith(`/despachos/${DESPACHO_ID}`) && (!init?.method || init.method === 'GET')) {
        return { status: 200, body: despachoPendiente }
      }
      expect(url).toContain(`/despachos/${DESPACHO_ID}/paradas/${PARADA_ID}/entregar`)
      expect(init?.method).toBe('POST')
      return {
        status: 200,
        body: {
          id: DESPACHO_ID,
          codigo: 'R-14',
          estado: 'finalizado',
          vehiculo: 'Camión 02',
          conductor: 'Luis',
          paradas: [{ id: PARADA_ID, orden: 1, pedido_id: PEDIDO_ID, entregada_at: '2026-10-12T18:00:00.000Z' }],
        },
      }
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/entrega')
    expect(screen.queryByRole('textbox', { name: 'Parada' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    expect(await screen.findByText('Parada 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Estado finalizado')).toBeInTheDocument()
    expect(screen.getByText('Despacho finalizado')).toBeInTheDocument()
    expect(screen.getByText('Entregada 2026-10-12T18:00:00.000Z')).toBeInTheDocument()
  })

  it('muestra el 409 y no escribe una hora de entrega', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((url, init) => {
      if (!init?.method || init.method === 'GET') return { status: 200, body: despachoPendiente }
      return { status: 409, body: { statusCode: 409, message: 'Parada ya entregada', error: 'Conflict' } }
    }))
    renderConSesion(<App />, 'despachador', '/despachos/entrega')
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    await user.click(await screen.findByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: Parada ya entregada')
    expect(screen.queryByText(/Entregada /)).not.toBeInTheDocument()
  })

  it('muestra la parada y el estado antes de iniciar la ruta', async () => {
    redes.push(instalarFetch((url, init) => {
      if (url.endsWith(`/despachos/${DESPACHO_ID}`) && (!init?.method || init.method === 'GET')) {
        return { status: 200, body: despachoPendiente }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    }))
    renderConSesion(<App />, 'despachador', '/despachos/iniciar')
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    expect(await screen.findByText('Parada 1')).toBeInTheDocument()
    expect(screen.getByText('Estado planificado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument()
  })
})
