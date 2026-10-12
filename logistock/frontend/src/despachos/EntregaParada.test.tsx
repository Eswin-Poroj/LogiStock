import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { DESPACHO_ID, PARADA_ID, PEDIDO_ID } from '../test/ids'

describe('entrega', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('muestra el estado y la hora que devuelve la API', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
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
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: PARADA_ID } })
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Despacho R-14')).toBeInTheDocument()
    expect(screen.getByText('Estado finalizado')).toBeInTheDocument()
    expect(screen.getByText('Entregada 2026-10-12T18:00:00.000Z')).toBeInTheDocument()
  })

  it('muestra el 409 y no escribe una hora de entrega', async () => {
    const user = userEvent.setup()
    const red = instalarFetch(() => ({ status: 409, body: { statusCode: 409, message: 'Parada ya entregada', error: 'Conflict' } }))
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/entrega')
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    fireEvent.change(screen.getByLabelText('Parada'), { target: { value: PARADA_ID } })
    await user.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: Parada ya entregada')
    expect(screen.queryByText(/Entregada /)).not.toBeInTheDocument()
  })
})
