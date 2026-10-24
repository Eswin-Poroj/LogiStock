import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID } from '../test/ids'

describe('daño', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('envía tipo danio y muestra la cantidad firmada que devuelve la API', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.includes('/productos?')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      if (url.endsWith('/inventario/ajustes') && init?.method === 'POST') {
        return {
          status: 201,
          body: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            producto_id: PRODUCTO_ID,
            bodega_id: BODEGA_ID,
            tipo: 'danio',
            cantidad: -2,
            created_at: '2026-10-12T00:00:00.000Z',
          },
        }
      }
      if (url.includes('/inventario?bodega_id=')) return { status: 200, body: { totales: { disponible: 8, reservado: 0, en_transito: 0, danado: 2 }, items: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', disponible: 8, reservado: 0, en_transito: 0, danado: 2, estado: 'normal' }] } }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/danio')
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
    await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Caja rota' } })
    await user.click(screen.getByRole('button', { name: 'Registrar daño' }))
    expect(await screen.findByText('Movimiento danio · Cantidad -2')).toBeInTheDocument()
    expect(await screen.findByText('Disponible: 8 · Reservado: 0 · Dañado: 2')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      producto_id: PRODUCTO_ID,
      bodega_id: BODEGA_ID,
      tipo: 'danio',
      cantidad: 2,
      motivo: 'Caja rota',
    })
  })

  it('no envía el daño sin motivo', async () => {
    const red = instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.includes('/productos?')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      return { status: 500, body: { statusCode: 500, message: 'no', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/danio')
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: BODEGA_ID } })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: PRODUCTO_ID } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '1' } })
    expect(screen.getByRole('button', { name: 'Registrar daño' })).toBeDisabled()
  })

  it('rellena producto y bodega desde la ficha del SKU', async () => {
    const red = instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.includes('/productos?')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
      return { status: 500, body: { statusCode: 500, message: 'no', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', `/inventario/danio?producto_id=${PRODUCTO_ID}&bodega_id=${BODEGA_ID}`)
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    expect(screen.getByLabelText('Producto')).toHaveValue(PRODUCTO_ID)
    expect(screen.getByLabelText('Bodega')).toHaveValue(BODEGA_ID)
  })
})
