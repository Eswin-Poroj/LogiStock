import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { PEDIDO_ID, PRODUCTO_ID } from '../test/ids'
import { paginar } from './paginar'

const producto = (i: number) => ({ id: `${i}`.padStart(8, '0') + '-0000-4000-8000-000000000000', sku: `FER-${String(i).padStart(4, '0')}`, nombre: `Producto ${i}`, unidad: 'u', precio_unitario: 1, stock_minimo: 0, activo: true })

describe('paginar', () => {
  it('corta en páginas de 10 y no se sale del rango', () => {
    const items = Array.from({ length: 23 }, (_, i) => i)
    expect(paginar(items, 3)).toEqual({ visibles: [20, 21, 22], paginas: 3, pagina: 3 })
    expect(paginar(items, 9).pagina).toBe(3)
    expect(paginar([], 1)).toEqual({ visibles: [], paginas: 1, pagina: 1 })
  })
})

describe('eliminar', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => {
    for (const red of redes) red.restaurar()
    vi.restoreAllMocks()
  })

  it('el catálogo pagina, busca y elimina un producto tras confirmar', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const lista = [{ ...producto(1), id: PRODUCTO_ID }, ...Array.from({ length: 13 }, (_, i) => producto(i + 2))]
    const red = instalarFetch((url, init) => {
      if (init?.method === 'DELETE') return { status: 200, body: null }
      if (url.includes('/productos?')) return { status: 200, body: lista }
      return { status: 200, body: [] }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    const tabla = await screen.findByRole('region', { name: 'Productos' })
    expect(await within(tabla).findByText('14 productos · página 1 de 2')).toBeInTheDocument()
    expect(within(tabla).queryByText('FER-0014')).not.toBeInTheDocument()
    await user.click(within(tabla).getByRole('button', { name: 'Siguiente' }))
    expect(within(tabla).getByText('FER-0014')).toBeInTheDocument()
    await user.type(within(tabla).getByLabelText('Buscar en la tabla'), 'FER-0001')
    expect(within(tabla).getByText('1 productos · página 1 de 1')).toBeInTheDocument()
    await user.click(within(tabla).getByRole('button', { name: 'Eliminar FER-0001' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Producto FER-0001 eliminado')
    expect(red.llamadas.some((l) => l.init?.method === 'DELETE' && l.url.endsWith(`/productos/${PRODUCTO_ID}`))).toBe(true)
  })

  it('si la API responde 409 por historial, avisa y no lo quita de la tabla', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    redes.push(instalarFetch((url, init) => {
      if (init?.method === 'DELETE') return { status: 409, body: { statusCode: 409, message: 'El producto tiene movimientos, pedidos o cotizaciones. Desactívalo para que deje de venderse.', error: 'Conflict' } }
      if (url.includes('/productos?')) return { status: 200, body: [{ ...producto(1), id: PRODUCTO_ID }] }
      return { status: 200, body: [] }
    }))
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(await screen.findByRole('button', { name: 'Eliminar FER-0001' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Desactívalo para que deje de venderse')
    expect(screen.getByText('FER-0001')).toBeInTheDocument()
  })

  it('sin confirmar no llama a la API', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const red = instalarFetch((url) => url.includes('/productos?') ? { status: 200, body: [{ ...producto(1), id: PRODUCTO_ID }] } : { status: 200, body: [] })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(await screen.findByRole('button', { name: 'Eliminar FER-0001' }))
    expect(red.llamadas.some((l) => l.init?.method === 'DELETE')).toBe(false)
  })

  it('en la lista de pedidos se cancela uno activo y luego se elimina', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/cancelar')) return { status: 200, body: {} }
      if (init?.method === 'DELETE') return { status: 200, body: null }
      return { status: 200, body: [{ id: PEDIDO_ID, numero: 'PED-000009', cliente: 'Cliente Pruebas', estado: 'creado', total: 100, created_at: '2026-10-24T00:00:00.000Z' }] }
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos/lista')
    expect(await screen.findByText('PED-000009')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar PED-000009' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar PED-000009' }))
    expect(await within(screen.getByRole('table')).findByText('Cancelado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Eliminar PED-000009' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido PED-000009 eliminado')
    expect(red.llamadas.some((l) => l.url.includes('/pedidos?pagina=1&limite=10'))).toBe(true)
  })
})
