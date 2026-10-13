import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PEDIDO_ID } from '../test/ids'

function pedido(estado: string) {
  return {
    id: PEDIDO_ID,
    numero: 'PED-000231',
    cliente: 'Ferretería El Tornillo',
    estado,
    total: 87.36,
    created_at: '2026-10-12T00:00:00.000Z',
    bodega_id: BODEGA_ID,
    subtotal: 78,
    iva: 9.36,
    lineas: [{
      id: 'abababab-abab-4aba-8aba-abababababab',
      producto_id: '44444444-4444-4444-8444-444444444444',
      sku: 'FER-0012',
      nombre: 'Cemento gris 42.5 kg',
      cantidad: 1,
      precio_unitario: 78,
      subtotal: 78,
      estado: 'reservada',
    }],
  }
}

describe('detalle del pedido', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('cancela un pedido creado y muestra Cancelado', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith(`/pedidos/${PEDIDO_ID}`) && (!init?.method || init.method === 'GET')) return { status: 200, body: pedido('creado') }
      if (url.endsWith(`/pedidos/${PEDIDO_ID}/cancelar`) && init?.method === 'POST') return { status: 200, body: pedido('cancelado') }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', `/pedidos/${PEDIDO_ID}`)
    expect(await screen.findByRole('heading', { name: 'Pedido PED-000231' })).toBeInTheDocument()
    expect(screen.getByText('Creado')).toBeInTheDocument()
    expect(screen.getByText('stock reservado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }))
    expect(await screen.findByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('stock liberado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument()
  })

  it('un pedido despachado no ofrece cancelar', async () => {
    const red = instalarFetch((url) => {
      if (url.endsWith(`/pedidos/${PEDIDO_ID}`)) return { status: 200, body: pedido('despachado') }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', `/pedidos/${PEDIDO_ID}`)
    expect(await screen.findByText('Despachado')).toBeInTheDocument()
    expect(screen.getByText('asignado a una ruta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument()
  })

  it('el 409 no pinta Cancelado', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (init?.method === 'POST') {
        return { status: 409, body: { statusCode: 409, message: 'No se puede cancelar un pedido en estado despachado', error: 'Conflict' } }
      }
      return { status: 200, body: pedido('en_preparacion') }
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', `/pedidos/${PEDIDO_ID}`)
    await user.click(await screen.findByRole('button', { name: 'Cancelar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: No se puede cancelar un pedido en estado despachado')
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument()
    expect(screen.getByText('En preparación')).toBeInTheDocument()
  })
})
