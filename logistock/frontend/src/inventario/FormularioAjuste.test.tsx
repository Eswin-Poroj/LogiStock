import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID } from '../test/ids'

function preparar(cantidad: string) {
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: PRODUCTO_ID } })
  fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: BODEGA_ID } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: cantidad } })
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Conteo' } })
}

describe('ajuste', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('deja el botón deshabilitado si la cantidad es cero', () => {
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    preparar('0')
    expect(screen.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled()
  })

  it('muestra el 409 cuando el negativo dejaría el stock bajo cero', async () => {
    const user = userEvent.setup()
    const red = instalarFetch(() => ({ status: 409, body: { statusCode: 409, message: 'El ajuste dejaría el stock negativo', error: 'Conflict' } }))
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    preparar('-8')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: El ajuste dejaría el stock negativo')
    expect(screen.queryByText(/Movimiento /)).not.toBeInTheDocument()
    expect(screen.queryByText('Stock actualizado')).not.toBeInTheDocument()
  })

  it('muestra el 501 del ajuste negativo que pasa la validación', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          producto_id: PRODUCTO_ID,
          bodega_id: BODEGA_ID,
          tipo: 'ajuste',
          cantidad: -3,
          motivo: 'Conteo',
        })
      }
      return { status: 501, body: { statusCode: 501, message: 'Pendiente: Iteración 2', error: 'Not Implemented' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    preparar('-3')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 2')
    expect(screen.queryByText(/Movimiento /)).not.toBeInTheDocument()
  })

  it('pinta el movimiento solo si la API responde 201', async () => {
    const user = userEvent.setup()
    const red = instalarFetch(() => ({
      status: 201,
      body: {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        producto_id: PRODUCTO_ID,
        bodega_id: BODEGA_ID,
        tipo: 'ajuste',
        cantidad: -3,
        created_at: '2026-10-12T00:00:00.000Z',
      },
    }))
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    preparar('-3')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('Movimiento eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')).toBeInTheDocument()
    expect(screen.getByText('Cantidad -3')).toBeInTheDocument()
  })
})
