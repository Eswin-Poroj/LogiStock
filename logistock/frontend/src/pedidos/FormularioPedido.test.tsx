
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import type { RespuestaMock } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, CLIENTE_ID, PEDIDO_ID, PRODUCTO_ID } from '../test/ids'

const producto = {
  id: PRODUCTO_ID,
  sku: 'FER-0012',
  nombre: 'Cemento gris 42.5 kg',
  unidad: 'unidad',
  precio_unitario: 78,
  stock_minimo: 0,
  activo: true,
}

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

function pedidoCreado(numero: string): RespuestaMock {
  return {
    status: 201,
    body: {
      id: '99999999-9999-4999-8999-999999999999',
      numero,
      cliente: 'Ferretería El Tornillo',
      estado: 'creado',
      total: 87.36,
      created_at: '2026-10-12T00:00:00.000Z',
      bodega_id: BODEGA_ID,
      subtotal: 78,
      iva: 9.36,
      lineas: [],
    },
  }
}

function instalar(disponible: number, pedido: RespuestaMock) {
  return instalarFetch((url, init) => {
    if (url.endsWith('/clientes')) return { status: 200, body: [{ id: CLIENTE_ID, nombre: 'Ferretería El Tornillo', nit: '1234567-8' }] }
    if (url.includes('/productos?q=')) return { status: 200, body: [producto] }
    if (url.endsWith('/productos')) return { status: 200, body: [producto] }
    if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
    if (url.includes(`/inventario?bodega_id=${BODEGA_ID}`)) return inventario(disponible)
    if (url.endsWith(`/pedidos/${PEDIDO_ID}`) && (!init?.method || init.method === 'GET')) return pedido
    if (url.endsWith('/pedidos') && init?.method === 'POST') return pedido
    return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
  })
}

async function base() {
  const user = userEvent.setup()
  await screen.findByRole('option', { name: 'Ferretería El Tornillo' })
  await screen.findByRole('option', { name: 'Bodega Central' })
  await user.selectOptions(screen.getByLabelText('Cliente'), CLIENTE_ID)
  await user.selectOptions(screen.getByLabelText('Bodega de despacho'), BODEGA_ID)
  return user
}

async function agregar(user: ReturnType<typeof userEvent.setup>, sku = 'FER-0012') {
  await user.type(screen.getByLabelText('Buscar por SKU o nombre'), sku)
  await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
}

describe('formulario de pedido', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('PU-02 deja Confirmar pedido deshabilitado sin líneas', () => {
    redes.push(instalar(0, pedidoCreado('PED-000000')))
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    expect(screen.getByRole('heading', { name: 'Nuevo pedido de venta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
    expect(screen.getByText('Se bloquea cada SKU por bodega para evitar que otro asesor reserve el mismo stock.')).toBeInTheDocument()
  })

  it('muestra el NIT, cotiza la línea con stock y confirma con rechazar', async () => {
    const red = instalar(10, pedidoCreado('PED-000232'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    expect(screen.getByLabelText('NIT')).toHaveValue('1234567-8')
    expect(screen.getByLabelText('NIT')).toBeDisabled()
    await agregar(user)
    expect(await screen.findByText('Reservable')).toBeInTheDocument()
    expect(screen.getByText(/Líneas confirmadas/)).toHaveTextContent('1 de 1')
    expect(within(screen.getByRole('heading', { name: 'Resumen' }).parentElement!).getByText(/Subtotal/)).toHaveTextContent('Q 78.00')
    expect(screen.getByText(/IVA 12 %/)).toHaveTextContent('Q 9.36')
    expect(screen.getByText(/^Total/)).toHaveTextContent('Q 87.36')
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('heading', { name: 'Pedido PED-000232' })).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/pedidos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      cliente_id: CLIENTE_ID,
      bodega_id: BODEGA_ID,
      politica_faltantes: 'rechazar',
      lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1 }],
    })
  })

  it('PU-01 ofrece ajustar, sustitutos y backorder sin inventar stock', async () => {
    const red = instalar(0, pedidoCreado('PED-000231'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    expect(await screen.findByText('FER-0012: solo hay 0 de 1 unidades en Bodega Central')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajustar a 0' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ver sustitutos' }))
    expect(screen.getByText('La API no tiene sustitutos. No se muestra ningún producto de reemplazo.')).toBeInTheDocument()
    expect(screen.getByTestId(`sustitutos-${PRODUCTO_ID}`).children).toHaveLength(0)
    expect(red.llamadas.some((llamada) => llamada.url.includes('/inventario/ajustes'))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Dejar como backorder' }))
    expect(screen.getByRole('button', { name: 'Dejar como backorder' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Las líneas sin stock no se incluyen en el total ni se reservan.')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: 'Resumen' }).parentElement!).getByText(/Subtotal/)).toHaveTextContent('Q 0.00')
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('heading', { name: 'Pedido PED-000231' })).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST' && llamada.url.endsWith('/pedidos'))
    expect(JSON.parse(String(post?.init?.body)).politica_faltantes).toBe('backorder')
  })

  it('Ajustar a 18 baja la cantidad al disponible y no llama a ajustes', async () => {
    const red = instalar(18, pedidoCreado('PED-000233'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    expect(await screen.findByText('Reservable')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cantidad FER-0012'), { target: { value: '60' } })
    expect(await screen.findByText('FER-0012: solo hay 18 de 60 unidades en Bodega Central')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajustar a 18' }))
    expect(screen.getByLabelText('Cantidad FER-0012')).toHaveValue(18)
    expect(screen.getByText('Reservable')).toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.url.includes('/inventario/ajustes'))).toBe(false)
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
    const user = await base()
    await agregar(user)
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo reservar el stock (FER-0012: solicitado 1, disponible 0).')
    expect(screen.queryByText(/Pedido PED-/)).not.toBeInTheDocument()
  })

  it('guardar como cotización no hace POST', async () => {
    const red = instalar(10, pedidoCreado('PED-000234'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    await screen.findByText('Reservable')
    await user.click(screen.getByRole('button', { name: 'Guardar como cotización' }))
    expect(screen.getByRole('status')).toHaveTextContent('La API no guarda cotizaciones. Confirma el pedido para reservar el stock.')
    expect(red.llamadas.some((llamada) => llamada.init?.method === 'POST')).toBe(false)
  })

  it('Cancelar vacía el borrador y no hace POST', async () => {
    const red = instalar(10, pedidoCreado('PED-000235'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    await screen.findByText('Reservable')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('NIT')).toHaveValue('')
    expect(screen.queryByLabelText('Cantidad FER-0012')).not.toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.init?.method === 'POST')).toBe(false)
  })
})
