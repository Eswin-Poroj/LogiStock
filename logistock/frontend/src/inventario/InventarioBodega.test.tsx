import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID } from '../test/ids'

const item = {
  producto_id: PRODUCTO_ID,
  sku: 'FER-0012',
  nombre: 'Cemento gris 42.5 kg',
  ubicacion: 'A-03-2',
  disponible: 312,
  reservado: 40,
  en_transito: 0,
  danado: 2,
  estado: 'normal',
}

const totales = { disponible: 12480, reservado: 1236, en_transito: 860, danado: 42 }

function instalar(items: unknown[]) {
  return instalarFetch((url) => {
    if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
    if (url.includes('/movimientos')) {
      return { status: 200, body: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', producto_id: PRODUCTO_ID, bodega_id: BODEGA_ID, tipo: 'reserva', cantidad: -40, referencia: 'PED-000231', created_at: '2026-10-12T00:00:00.000Z' }] }
    }
    if (url.includes('/inventario?')) return { status: 200, body: { totales, items } }
    return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
  })
}

describe('inventario por bodega', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('muestra totales y enlaces de escritura para el operario', async () => {
    redes.push(instalar([item]))
    renderConSesion(<App />, 'operario_bodega', '/inventario')
    expect(await screen.findByRole('heading', { name: 'Inventario por bodega' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Disponible' })).getByText('12480')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Reservado' })).getByText('1236')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'En tránsito' })).getByText('860')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Dañado' })).getByText('42')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar entrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar ajuste' })).toBeInTheDocument()
  })

  it('filtra por texto y estado y limpia cuando no hay filas', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.includes('estado=agotado')) return { status: 200, body: { totales, items: [] } }
      if (url.includes('/inventario?')) return { status: 200, body: { totales, items: [item] } }
      return { status: 500, body: { statusCode: 500, message: 'no', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario')
    await screen.findByRole('button', { name: /FER-0012/ })
    await user.type(screen.getByLabelText('Buscar por SKU o producto'), 'FER-0012')
    await user.selectOptions(screen.getByLabelText('Estado'), 'agotado')
    expect(await screen.findByText('No hay existencias con esos filtros.')).toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.url.includes('q=FER-0012') && llamada.url.includes('estado=agotado'))).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(await screen.findByRole('button', { name: /FER-0012/ })).toBeInTheDocument()
  })

  it('abre los movimientos del SKU', async () => {
    const user = userEvent.setup()
    const red = instalar([item])
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario')
    await user.click(await screen.findByRole('button', { name: /FER-0012/ }))
    expect(await screen.findByText('Reserva')).toBeInTheDocument()
    expect(screen.getByText('PED-000231')).toBeInTheDocument()
    expect(screen.getByText('-40')).toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.url.includes(`/inventario/${PRODUCTO_ID}/movimientos?bodega_id=${BODEGA_ID}`))).toBe(true)
  })

  it('el asesor no ve acciones de escritura', async () => {
    redes.push(instalar([item]))
    renderConSesion(<App />, 'asesor_ventas', '/inventario')
    expect(await screen.findByRole('button', { name: /FER-0012/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar ajuste' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar daño' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrar entrada' })).not.toBeInTheDocument()
    renderConSesion(<App />, 'asesor_ventas', '/inventario/entradas')
    expect(await screen.findByRole('alert')).toHaveTextContent('Inventario es de solo lectura para tu rol.')
    expect(screen.queryByRole('button', { name: 'Registrar entrada' })).not.toBeInTheDocument()
  })
})
