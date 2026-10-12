import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID, PROVEEDOR_ID } from '../test/ids'

describe('entrada', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('envía la entrada y muestra el código que devuelve la API', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.endsWith('/productos')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      if (url.endsWith('/inventario/entradas') && init?.method === 'POST') {
        return { status: 201, body: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', codigo: 'OC-004118', estado: 'recibida', created_at: '2026-10-12T00:00:00.000Z' } }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario')
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: PROVEEDOR_ID } })
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'Cemento gris 42.5 kg' })
    await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
    await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Recepción OC-004118')).toBeInTheDocument()
    expect(screen.getByText('Estado recibida')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      proveedor_id: PROVEEDOR_ID,
      bodega_id: BODEGA_ID,
      lineas: [{ producto_id: PRODUCTO_ID, cantidad: 4 }],
    })
  })

  it('muestra el error de la API y no inventa un código de recepción', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.endsWith('/productos')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      return { status: 400, body: { statusCode: 400, message: 'No se pudo crear la recepción', error: 'Bad Request' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario')
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: PROVEEDOR_ID } })
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'Cemento gris 42.5 kg' })
    await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
    await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 400: No se pudo crear la recepción')
    expect(screen.queryByText(/Recepción OC-/)).not.toBeInTheDocument()
  })
})
