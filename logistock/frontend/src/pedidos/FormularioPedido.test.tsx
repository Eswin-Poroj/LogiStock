
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

const SUSTITUTO_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const COTIZACION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const cotizacion = {
  id: COTIZACION_ID, numero: 'COT-000007', cliente_id: CLIENTE_ID, cliente: 'Ferretería El Tornillo', bodega_id: BODEGA_ID,
  subtotal: 156, iva: 18.72, total: 174.72, pedido_id: null, created_at: '2026-10-24T00:00:00.000Z',
  lineas: [{ producto_id: PRODUCTO_ID, sku: 'FER-0012', nombre: 'Cemento gris 42.5 kg', cantidad: 2, precio_unitario: 78, subtotal: 156 }],
}

function instalar(disponible: number, pedido: RespuestaMock, extra?: (url: string, init?: RequestInit) => RespuestaMock | undefined) {
  return instalarFetch((url, init) => {
    const propia = extra?.(url, init)
    if (propia) return propia
    if (url.endsWith('/cotizaciones') && (!init?.method || init.method === 'GET')) return { status: 200, body: [] }
    if (url.includes('/clientes?')) return { status: 200, body: [{ id: CLIENTE_ID, nombre: 'Ferretería El Tornillo', nit: '1234567-8' }] }
    if (url.includes('/productos?q=')) return { status: 200, body: [producto] }
    if (url.includes('/productos?limite=')) return { status: 200, body: [producto] }
    if (url.includes('/sustitutos')) return { status: 200, body: [] }
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
    expect(await screen.findByText('No hay sustitutos de la misma categoría con 1 unidades disponibles.')).toBeInTheDocument()
    expect(screen.getByTestId(`sustitutos-${PRODUCTO_ID}`).children).toHaveLength(0)
    expect(red.llamadas.some((llamada) => llamada.url.includes(`/productos/${PRODUCTO_ID}/sustitutos?bodega_id=${BODEGA_ID}&cantidad=1`))).toBe(true)
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

  it('usa un sustituto con stock en lugar de la línea sin stock', async () => {
    const red = instalar(0, pedidoCreado('PED-000236'), (url) => url.includes('/sustitutos')
      ? { status: 200, body: [{ producto_id: SUSTITUTO_ID, sku: 'FER-0013', nombre: 'Cemento blanco', precio_unitario: 80, disponible: 40 }] }
      : undefined)
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    await user.click(await screen.findByRole('button', { name: 'Ver sustitutos' }))
    await user.click(await screen.findByRole('button', { name: 'Usar FER-0013' }))
    expect(screen.queryByLabelText('Cantidad FER-0012')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad FER-0013')).toHaveValue(1)
    expect(screen.getByText('Reservable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled()
  })

  it('guarda la cotización sin reservar stock y muestra su número', async () => {
    const red = instalar(10, pedidoCreado('PED-000234'), (url, init) => url.endsWith('/cotizaciones') && init?.method === 'POST'
      ? { status: 201, body: cotizacion }
      : undefined)
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = await base()
    await agregar(user)
    await screen.findByText('Reservable')
    await user.click(screen.getByRole('button', { name: 'Guardar como cotización' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Cotización COT-000007 guardada por Q 174.72. No reserva stock hasta confirmar el pedido.')
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(post?.url).toMatch(/\/cotizaciones$/)
    expect(JSON.parse(String(post?.init?.body))).toEqual({ cliente_id: CLIENTE_ID, bodega_id: BODEGA_ID, lineas: [{ producto_id: PRODUCTO_ID, cantidad: 1 }] })
    expect(red.llamadas.some((llamada) => llamada.url.endsWith('/pedidos') && llamada.init?.method === 'POST')).toBe(false)
  })

  it('abre una cotización guardada y la confirma enlazada al pedido', async () => {
    const red = instalar(10, pedidoCreado('PED-000237'), (url) => {
      if (url.endsWith('/cotizaciones')) return { status: 200, body: [{ id: COTIZACION_ID, numero: 'COT-000007', cliente: 'Ferretería El Tornillo', total: 174.72, created_at: '2026-10-24T00:00:00.000Z', pedido_id: null }] }
      if (url.endsWith(`/cotizaciones/${COTIZACION_ID}`)) return { status: 200, body: cotizacion }
      return undefined
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'Ferretería El Tornillo' })
    await user.selectOptions(await screen.findByLabelText('Abrir cotización'), COTIZACION_ID)
    expect(await screen.findByLabelText('Cantidad FER-0012')).toHaveValue(2)
    expect(screen.getByLabelText('NIT')).toHaveValue('1234567-8')
    await user.click(await screen.findByRole('button', { name: 'Confirmar pedido' }))
    expect(await screen.findByRole('heading', { name: 'Pedido PED-000237' })).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.url.endsWith('/pedidos') && llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body)).cotizacion_id).toBe(COTIZACION_ID)
  })

  it('registra un cliente nuevo y lo deja elegido', async () => {
    const NUEVO_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const red = instalar(10, pedidoCreado('PED-000238'), (url, init) => {
      if (url.includes('nominatim.openstreetmap.org/search')) {
        return { status: 200, body: [{ display_name: '4a Calle, Zona 1, Quetzaltenango, Guatemala', lat: '14.8500001', lon: '-91.5000004', address: { road: '4a Calle', suburb: 'Zona 1', city: 'Quetzaltenango' } }] }
      }
      if (url.endsWith('/clientes') && init?.method === 'POST') return { status: 201, body: { id: NUEVO_ID, nombre: 'Agro San Juan', nit: '998877-1', latitud: 14.85, longitud: -91.5 } }
      return undefined
    })
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'Ferretería El Tornillo' })
    await user.click(screen.getByRole('button', { name: '¿El cliente no existe? Registrarlo' }))
    const alta = screen.getByRole('form', { name: 'Nuevo cliente' })
    await user.type(within(alta).getByLabelText('Nombre'), 'Agro San Juan')
    await user.type(within(alta).getByLabelText('NIT'), '998877-1')
    expect(within(alta).queryByLabelText('Latitud')).not.toBeInTheDocument()
    await user.type(within(alta).getByLabelText('Buscar dirección'), '4a calle zona 1 Xela')
    await user.click(within(alta).getByRole('button', { name: 'Buscar' }))
    await user.click(await within(alta).findByRole('button', { name: '4a Calle, Zona 1, Quetzaltenango, Guatemala' }))
    expect(within(alta).getByText('14.85, -91.5')).toBeInTheDocument()
    expect(within(alta).getByLabelText('Dirección')).toHaveValue('4a Calle, Zona 1')
    expect(within(alta).getByLabelText('Municipio')).toHaveValue('Quetzaltenango')
    await user.click(within(alta).getByRole('button', { name: 'Guardar cliente' }))
    expect(await screen.findByDisplayValue('998877-1')).toBeDisabled()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      nombre: 'Agro San Juan', nit: '998877-1', direccion: '4a Calle, Zona 1', municipio: 'Quetzaltenango', latitud: 14.85, longitud: -91.5,
    })
  })

  it('muestra los productos del catálogo y los agrega con un clic', async () => {
    const red = instalar(10, pedidoCreado('PED-000239'))
    redes.push(red)
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    const panel = await screen.findByRole('region', { name: 'Productos disponibles' })
    expect(await within(panel).findByText('FER-0012')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Agregar FER-0012' })).toBeDisabled()
    const user = await base()
    expect(await within(panel).findByText('10')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Agregar FER-0012' }))
    expect(await screen.findByLabelText('Cantidad FER-0012')).toHaveValue(1)
    await user.click(within(panel).getByRole('button', { name: 'Agregar FER-0012' }))
    expect(screen.getByLabelText('Cantidad FER-0012')).toHaveValue(2)
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
