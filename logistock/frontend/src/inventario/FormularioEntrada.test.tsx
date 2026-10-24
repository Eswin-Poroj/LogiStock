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
      if (url.endsWith('/proveedores')) return { status: 200, body: [{ id: PROVEEDOR_ID, nombre: 'Cementos Progreso' }] }
      if (url.includes('/inventario?bodega_id=')) return { status: 200, body: { totales: { disponible: 104, reservado: 0, en_transito: 0, danado: 0 }, items: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', disponible: 104, reservado: 0, en_transito: 0, danado: 0, estado: 'normal' }] } }
      if (url.includes('/productos?')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      if (url.endsWith('/inventario/entradas') && init?.method === 'POST') {
        return { status: 201, body: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', codigo: 'OC-004118', estado: 'recibida', created_at: '2026-10-12T00:00:00.000Z' } }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/entradas')
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeDisabled()
    await user.selectOptions(await screen.findByLabelText('Proveedor'), await screen.findByRole('option', { name: 'Cementos Progreso' }))
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
    await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Recepción OC-004118')).toBeInTheDocument()
    expect(screen.getByText('Estado recibida')).toBeInTheDocument()
    expect(await screen.findByText('FER-0012: disponible 104')).toBeInTheDocument()
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
      if (url.endsWith('/proveedores')) return { status: 200, body: [{ id: PROVEEDOR_ID, nombre: 'Cementos Progreso' }] }
      if (url.includes('/inventario?bodega_id=')) return { status: 200, body: { totales: { disponible: 104, reservado: 0, en_transito: 0, danado: 0 }, items: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', disponible: 104, reservado: 0, en_transito: 0, danado: 0, estado: 'normal' }] } }
      if (url.includes('/productos?')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      return { status: 400, body: { statusCode: 400, message: 'No se pudo crear la recepción', error: 'Bad Request' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/entradas')
    await user.selectOptions(await screen.findByLabelText('Proveedor'), await screen.findByRole('option', { name: 'Cementos Progreso' }))
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
    await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 400: No se pudo crear la recepción')
    expect(screen.queryByText(/Recepción OC-/)).not.toBeInTheDocument()
  })

  it('junta varias líneas en una sola recepción', async () => {
    const user = userEvent.setup()
    const OTRO_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.endsWith('/proveedores')) return { status: 200, body: [{ id: PROVEEDOR_ID, nombre: 'Cementos Progreso' }] }
      if (url.includes('/productos?')) return { status: 200, body: [
        { id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true },
        { id: OTRO_ID, sku: 'FER-0020', nombre: 'Varilla 3/8', unidad: 'unidad', precio_unitario: 40, stock_minimo: 0, activo: true },
      ] }
      if (url.includes('/inventario?bodega_id=')) return { status: 200, body: { totales: { disponible: 0, reservado: 0, en_transito: 0, danado: 0 }, items: [] } }
      if (init?.method === 'POST') return { status: 201, body: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', codigo: 'OC-004119', estado: 'recibida', created_at: '2026-10-12T00:00:00.000Z' } }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/entradas')
    await user.selectOptions(screen.getByLabelText('Proveedor'), await screen.findByRole('option', { name: 'Cementos Progreso' }))
    await user.selectOptions(screen.getByLabelText('Bodega'), await screen.findByRole('option', { name: 'Bodega Central' }))
    await user.selectOptions(screen.getByLabelText('Producto'), await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' }))
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '10' } })
    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    await user.selectOptions(screen.getByLabelText('Producto'), OTRO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '5' } })
    await user.click(screen.getByRole('button', { name: 'Registrar entrada' }))
    expect(await screen.findByText('Recepción OC-004119')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body)).lineas).toEqual([{ producto_id: PRODUCTO_ID, cantidad: 10 }, { producto_id: OTRO_ID, cantidad: 5 }])
  })
})
