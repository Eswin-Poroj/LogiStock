import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, CLIENTE_ID, PRODUCTO_ID } from '../test/ids'
import type { RespuestaMock } from '../test/mockFetch'

function inventario(disponible: number): RespuestaMock {
  return {
    status: 200,
    body: {
      totales: { disponible, reservado: 0, en_transito: 0, danado: 0 },
      items: [{
        producto_id: PRODUCTO_ID,
        sku: 'FER-0012',
        nombre: 'Cemento gris 42.5 kg',
        ubicacion: 'A-03-2',
        disponible,
        reservado: 0,
        en_transito: 0,
        danado: 0,
        estado: disponible === 0 ? 'agotado' : 'normal',
      }],
    },
  }
}

function instalar(disponible: number, pedido: RespuestaMock) {
  return instalarFetch((url, init) => {
    if (url.endsWith('/clientes')) return { status: 200, body: [{ id: CLIENTE_ID, nombre: 'Ferretería El Tornillo', nit: '1234567-8' }] }
    if (url.endsWith('/productos')) return { status: 200, body: [{ id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', unidad: 'unidad', precio_unitario: 78, stock_minimo: 0, activo: true }] }
    if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
    if (url.includes(`/inventario?bodega_id=${BODEGA_ID}`)) return inventario(disponible)
    if (url.endsWith('/pedidos') && init?.method === 'POST') return pedido
    return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
  })
}

async function elegirLinea() {
  const user = userEvent.setup()
  await screen.findByRole('option', { name: 'Ferretería El Tornillo' })
  await screen.findByRole('option', { name: 'Bodega Central' })
  await screen.findByRole('option', { name: 'Cemento gris 42.5 kg' })
  await user.selectOptions(screen.getByLabelText('Cliente'), CLIENTE_ID)
  await user.selectOptions(screen.getByLabelText('Bodega'), BODEGA_ID)
  await user.selectOptions(screen.getByLabelText('Producto'), PRODUCTO_ID)
  return user
}

describe('formulario de pedido', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => {
    for (const red of redes) red.restaurar()
  })

  it('PU-02 deja Confirmar pedido deshabilitado con el formulario vacío', () => {
    const red = instalar(0, { status: 500, body: { statusCode: 500, message: 'no', error: 'Error' } })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
  })

  it('PU-01 muestra Ajustar, Ver sustitutos y Backorder cuando no hay stock', async () => {
    const red = instalar(0, {
      status: 201,
      body: {
        id: '99999999-9999-4999-8999-999999999999',
        numero: 'PED-000231',
        cliente: 'Ferretería El Tornillo',
        estado: 'creado',
        total: 0,
        created_at: '2026-10-12T00:00:00.000Z',
        bodega_id: BODEGA_ID,
        subtotal: 0,
        iva: 0,
        lineas: [],
      },
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await elegirLinea()
    expect(await screen.findByRole('status')).toHaveTextContent('Esta línea no tiene stock suficiente. Disponible: 0. Solicitado: 1.')
    expect(screen.getByRole('button', { name: 'Ajustar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver sustitutos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Backorder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ajustar' }))
    expect(screen.getByText('No se envió un ajuste. Un ajuste positivo responde 501 y esta pantalla no inventa existencias.')).toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.url.includes('/inventario/ajustes'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Ver sustitutos' }))
    expect(screen.getByText('La API no tiene sustitutos. No se muestra ningún producto de reemplazo.')).toBeInTheDocument()
    expect(screen.getByTestId('sustitutos').children).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Backorder' }))
    expect(screen.getByRole('button', { name: 'Backorder' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Las líneas sin stock quedan en backorder.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByText('Pedido PED-000231')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/pedidos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      cliente_id: CLIENTE_ID,
      bodega_id: BODEGA_ID,
      politica_faltantes: 'backorder',
      lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1 }],
    })
  })

  it('PU-02 habilita Confirmar pedido cuando la línea tiene stock', async () => {
    const red = instalar(10, {
      status: 201,
      body: {
        id: '99999999-9999-4999-8999-999999999999',
        numero: 'PED-000232',
        cliente: 'Ferretería El Tornillo',
        estado: 'creado',
        total: 78,
        created_at: '2026-10-12T00:00:00.000Z',
        bodega_id: BODEGA_ID,
        subtotal: 78,
        iva: 0,
        lineas: [],
      },
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await elegirLinea()
    expect(await screen.findByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Ajustar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByText('Pedido PED-000232')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body)).politica_faltantes).toBe('rechazar')
  })

  it('muestra el 409 de stock sin pintar un número de pedido', async () => {
    const red = instalar(10, {
      status: 409,
      body: {
        statusCode: 409,
        message: 'Stock insuficiente',
        error: 'Conflict',
        lineas_sin_stock: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', solicitado: 1, disponible: 0 }],
      },
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await elegirLinea()
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: Stock insuficiente')
    expect(screen.getByText('FER-0012: solicitado 1, disponible 0')).toBeInTheDocument()
    expect(screen.queryByText(/Pedido PED-/)).not.toBeInTheDocument()
  })

  it('sube la cantidad y el aviso usa el valor nuevo', async () => {
    const red = instalar(0, { status: 500, body: { statusCode: 500, message: 'no', error: 'Error' } })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    await elegirLinea()
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    expect(await screen.findByRole('status')).toHaveTextContent('Solicitado: 4.')
  })
})
