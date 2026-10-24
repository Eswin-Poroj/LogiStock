import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import type { RespuestaMock } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID } from '../test/ids'

const producto = { id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }
const inventario = {
  totales: { disponible: 15, reservado: 2, en_transito: 0, danado: 1 },
  items: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', ubicacion: 'A-03-2', disponible: 15, reservado: 2, en_transito: 0, danado: 1, estado: 'normal' }],
}

function red(post: () => RespuestaMock) {
  return instalarFetch((url, init) => {
    if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
    if (url.includes('/productos?')) return { status: 200, body: [producto] }
    if (url.includes('/inventario?bodega_id=')) return { status: 200, body: inventario }
    if (url.endsWith('/inventario/ajustes') && init?.method === 'POST') return post()
    return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
  })
}

async function preparar(cantidad: string, motivo = 'Conteo') {
  await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
  await screen.findByRole('option', { name: 'Bodega Central' })
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: PRODUCTO_ID } })
  fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: BODEGA_ID } })
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: cantidad } })
  if (motivo) fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: motivo } })
}

describe('ajuste', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const r of redes) r.restaurar() })

  it('deja el botón deshabilitado si la cantidad es cero', async () => {
    redes.push(red(() => ({ status: 500, body: {} })))
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    await preparar('0')
    expect(screen.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled()
  })

  it('no envía el ajuste sin motivo', async () => {
    redes.push(red(() => ({ status: 500, body: {} })))
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    await preparar('4', '')
    expect(screen.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled()
  })

  it('muestra el 409 cuando el negativo dejaría el stock bajo cero', async () => {
    const user = userEvent.setup()
    redes.push(red(() => ({ status: 409, body: { statusCode: 409, message: 'El ajuste dejaría el stock negativo', error: 'Conflict' } })))
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    await preparar('-80')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: El ajuste dejaría el stock negativo')
    expect(screen.queryByText('Stock actualizado')).not.toBeInTheDocument()
  })

  it('registra un ajuste positivo y muestra el stock que devuelve la API', async () => {
    const user = userEvent.setup()
    const r = red(() => ({
      status: 201,
      body: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', producto_id: PRODUCTO_ID, bodega_id: BODEGA_ID, tipo: 'ajuste', cantidad: 4, referencia: 'Conteo', created_at: '2026-10-12T00:00:00.000Z' },
    }))
    redes.push(r)
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    await preparar('4')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('Stock actualizado')).toBeInTheDocument()
    expect(screen.getByText('Movimiento ajuste · Cantidad +4')).toBeInTheDocument()
    expect(await screen.findByText('Disponible: 15 · Reservado: 2 · Dañado: 1')).toBeInTheDocument()
    const post = r.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({ producto_id: PRODUCTO_ID, bodega_id: BODEGA_ID, tipo: 'ajuste', cantidad: 4, motivo: 'Conteo' })
  })

  it('rellena producto y bodega desde la ficha del SKU', async () => {
    redes.push(red(() => ({ status: 500, body: {} })))
    renderConSesion(<App />, 'operario_bodega', `/inventario/ajustes?producto_id=${PRODUCTO_ID}&bodega_id=${BODEGA_ID}`)
    await screen.findByRole('option', { name: 'Bodega Central' })
    await screen.findByRole('option', { name: 'FER-0012 · Cemento gris 42.5 kg' })
    expect(screen.getByLabelText('Producto')).toHaveValue(PRODUCTO_ID)
    expect(screen.getByLabelText('Bodega')).toHaveValue(BODEGA_ID)
  })
})
