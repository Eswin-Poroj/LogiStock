import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import type { Cotizacion } from '../dominio/tipos'
import { filasCotizacion, nombreArchivo } from './pdfCotizacion'

const guardar = vi.fn()
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 612, getHeight: () => 792 } },
    setFillColor: vi.fn(), rect: vi.fn(), setTextColor: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(), text: vi.fn(),
    setDrawColor: vi.fn(), line: vi.fn(), getNumberOfPages: () => 1, setPage: vi.fn(), save: guardar,
    lastAutoTable: { finalY: 400 },
  })),
}))
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

const cotizacion: Cotizacion = {
  id: 'c-1', numero: 'COT-000003', cliente: 'Walmart 1', cliente_id: 'x', bodega_id: 'y', cliente_nit: '123', bodega: 'Bodega Central', asesor: 'Asesor Pruebas',
  subtotal: 330, iva: 39.6, total: 369.6, created_at: '2026-10-24T15:00:00Z', pedido_id: null,
  lineas: [
    { producto_id: 'p1', sku: 'FER-0012', nombre: 'Cemento gris', cantidad: 10, precio_unitario: 30, subtotal: 300 },
    { producto_id: 'p2', sku: 'LAC-0001', nombre: 'Leche deslactosada', cantidad: 2, precio_unitario: 15, subtotal: 30 },
  ],
}

describe('PDF de la cotización', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const r of redes) r.restaurar(); guardar.mockClear() })

  it('arma una fila por producto con cantidades y montos', () => {
    expect(filasCotizacion(cotizacion)).toEqual([
      ['1', 'FER-0012', 'Cemento gris', '10', 'Q 30.00', 'Q 300.00'],
      ['2', 'LAC-0001', 'Leche deslactosada', '2', 'Q 15.00', 'Q 30.00'],
    ])
    expect(nombreArchivo(cotizacion)).toBe('COT-000003.pdf')
  })

  it('desde la lista descarga el PDF con el detalle de la API', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url) => {
      if (url.endsWith('/cotizaciones')) return { status: 200, body: [{ id: 'c-1', numero: 'COT-000003', cliente: 'Walmart 1', total: 369.6, created_at: '2026-10-24T15:00:00Z', pedido_id: null }] }
      if (url.endsWith('/cotizaciones/c-1')) return { status: 200, body: cotizacion }
      return { status: 200, body: {} }
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos/cotizaciones')
    await user.click(await screen.findByRole('button', { name: 'PDF de COT-000003' }))
    await vi.waitFor(() => expect(guardar).toHaveBeenCalledWith('COT-000003.pdf'))
    expect(red.llamadas.some((l) => l.url.endsWith('/cotizaciones/c-1'))).toBe(true)
  })
})
