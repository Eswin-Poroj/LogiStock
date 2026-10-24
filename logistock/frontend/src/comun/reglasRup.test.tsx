import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import type { RespuestaMock } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, CLIENTE_ID, PEDIDO_ID, PRODUCTO_ID } from '../test/ids'

const producto = { id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris', unidad: 'saco', precio_unitario: 100, stock_minimo: 0, activo: true }
const inventario = { totales: { disponible: 50, reservado: 0, en_transito: 0, danado: 0 }, items: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris', disponible: 50, reservado: 0, en_transito: 0, danado: 0, estado: 'normal' }] }
const config = { iva_pct: 12, descuento_max_pct: 10, ajuste_max_pct: 20 }

function red(extra: (url: string, init?: RequestInit) => RespuestaMock | undefined) {
  return instalarFetch((url, init) => {
    const propia = extra(url, init)
    if (propia) return propia
    if (url.endsWith('/configuracion')) return { status: 200, body: config }
    if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
    if (url.includes('/clientes?')) return { status: 200, body: [{ id: CLIENTE_ID, nombre: 'Ferretería El Tornillo', nit: '1' }] }
    if (url.includes('/productos?')) return { status: 200, body: [producto] }
    if (url.includes('/inventario?bodega_id=')) return { status: 200, body: inventario }
    return { status: 200, body: [] }
  })
}

describe('reglas del RUP en la interfaz', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const r of redes) r.restaurar(); vi.restoreAllMocks() })

  it('CU-01 A2: sobre el máximo pide supervisor y manda la autorización', async () => {
    const user = userEvent.setup()
    const creado = { id: PEDIDO_ID, numero: 'PED-000050', cliente: 'Ferretería El Tornillo', estado: 'creado', total: 95.2, created_at: '2026-10-24T00:00:00Z', bodega_id: BODEGA_ID, subtotal: 100, iva: 10.2, descuento_pct: 15, descuento: 15, autorizado_por: 'Admin Pruebas', lineas: [] }
    const r = red((url, init) => {
      if (url.endsWith('/pedidos') && init?.method === 'POST') return { status: 201, body: creado }
      if (url.endsWith(`/pedidos/${PEDIDO_ID}`)) return { status: 200, body: creado }
      return undefined
    })
    redes.push(r)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    await user.selectOptions(screen.getByLabelText('Cliente'), await screen.findByRole('option', { name: 'Ferretería El Tornillo' }))
    await user.selectOptions(screen.getByLabelText('Bodega de despacho'), await screen.findByRole('option', { name: 'Bodega Central' }))
    await user.click(await screen.findByRole('button', { name: 'Agregar FER-0012' }))
    await screen.findByLabelText('Cantidad FER-0012')
    fireEvent.change(screen.getByLabelText('Descuento %'), { target: { value: '8' } })
    expect(screen.getByText(/^Descuento 8 %/)).toHaveTextContent('-Q 8.00')
    expect(screen.queryByText('Autorización de supervisor')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descuento %'), { target: { value: '15' } })
    expect(screen.getByText('Autorización de supervisor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
    await user.type(screen.getByLabelText('Correo del supervisor'), 'jefe@logistock.local')
    await user.type(screen.getByLabelText('Contraseña del supervisor'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    await screen.findByRole('heading', { name: 'Pedido PED-000050' })
    expect(screen.getByText(/Descuento 15 %/)).toHaveTextContent('autorizó Admin Pruebas')
    const post = r.llamadas.find((l) => l.url.endsWith('/pedidos') && l.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({ descuento_pct: 15, autorizacion: { correo: 'jefe@logistock.local', clave: 'secreta' } })
  })

  it('CU-04 A1: avisa antes y muestra que el ajuste grande quedó pendiente', async () => {
    const user = userEvent.setup()
    redes.push(red((url, init) => url.endsWith('/inventario/ajustes') && init?.method === 'POST'
      ? { status: 201, body: { id: 'x', cantidad: 30, estado: 'pendiente', pendiente: true } }
      : undefined))
    renderConSesion(<App />, 'operario_bodega', `/inventario/ajustes?producto_id=${PRODUCTO_ID}&bodega_id=${BODEGA_ID}`)
    expect(await screen.findByText(/Hasta 10 unidades se aplican de inmediato/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Conteo anual' } })
    expect(screen.getByText(/quedará pendiente de aprobación/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('status')).toHaveTextContent('espera la aprobación de un administrador')
    expect(screen.queryByText('Stock actualizado')).not.toBeInTheDocument()
  })

  it('CU-04 A1: el administrador aprueba desde la lista', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const r = red((url, init) => {
      if (url.includes('/ajustes/pendientes')) return { status: 200, body: [{ id: 'aj-1', sku: 'FER-0012', nombre: 'Cemento gris', bodega: 'Bodega Central', cantidad: 30, disponible: 50, motivo: 'Conteo anual', estado: 'pendiente', solicitado_por: 'Operario Pruebas', revisado_por: null, created_at: '2026-10-24T00:00:00Z' }] }
      if (url.endsWith('/ajustes/aj-1/aprobar') && init?.method === 'POST') return { status: 200, body: { id: 'aj-1', estado: 'aprobado' } }
      return undefined
    })
    redes.push(r)
    renderConSesion(<App />, 'administrador', '/inventario/aprobaciones')
    expect(await screen.findByText('Conteo anual')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprobar FER-0012' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ajuste de FER-0012 aprobado y aplicado')
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('pasará de 50 a 80'))
  })

  it('CU-05 E2: la campana cuenta los avisos sin leer y enlaza al pedido', async () => {
    const user = userEvent.setup()
    const r = red((url, init) => {
      if (url.endsWith('/notificaciones')) return { status: 200, body: [{ id: 'n-1', tipo: 'picking_faltante', mensaje: 'El picking de PED-000231 quedó con faltante: FER-0012 (3 de 5).', pedido_id: PEDIDO_ID, leida: false, created_at: new Date().toISOString() }] }
      if (url.endsWith('/notificaciones/n-1/leida') && init?.method === 'POST') return { status: 200, body: { id: 'n-1', leida: true } }
      return undefined
    })
    redes.push(r)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos/lista')
    await user.click(await screen.findByRole('button', { name: 'Avisos, 1 sin leer' }))
    const panel = screen.getByRole('dialog', { name: 'Avisos' })
    expect(within(panel).getByText(/quedó con faltante/)).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Marcar leído' }))
    expect(screen.getByRole('button', { name: 'Avisos' })).toBeInTheDocument()
    expect(r.llamadas.some((l) => l.url.endsWith('/notificaciones/n-1/leida'))).toBe(true)
  })

  it('un producto con historial ofrece desactivarlo en lugar de borrarlo', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const r = red((_url, init) => {
      if (init?.method === 'DELETE') return { status: 409, body: { statusCode: 409, message: 'El producto tiene movimientos, pedidos o cotizaciones. Desactívalo para que deje de venderse.', error: 'Conflict' } }
      if (init?.method === 'PATCH') return { status: 200, body: { ...producto, activo: false } }
      return undefined
    })
    redes.push(r)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(await screen.findByRole('button', { name: 'Eliminar FER-0012' }))
    await user.click(await screen.findByRole('button', { name: 'Desactivar en su lugar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Producto FER-0012 desactivado')
    expect(within(screen.getByRole('region', { name: 'Productos' })).getByText('Inactivo')).toBeInTheDocument()
    expect(JSON.parse(String(r.llamadas.find((l) => l.init?.method === 'PATCH')?.init?.body))).toEqual({ activo: false })
  })
})
