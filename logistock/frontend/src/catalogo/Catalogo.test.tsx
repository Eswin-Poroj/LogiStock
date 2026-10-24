import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, PRODUCTO_ID, PROVEEDOR_ID } from '../test/ids'

const creado = { id: PRODUCTO_ID, sku: 'FER-0001', categoria: 'Ferretería', nombre: 'Cemento gris 42.5 kg', unidad: 'saco', precio_unitario: 78, stock_minimo: 20, activo: true }

describe('catálogo', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('genera el SKU desde la categoría: no se escribe a mano', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [{ id: BODEGA_ID, nombre: 'Bodega Central' }] }
      if (url.includes('/productos?') && (!init?.method || init.method === 'GET')) return { status: 200, body: [] }
      if (url.endsWith('/productos') && init?.method === 'POST') return { status: 201, body: creado }
      return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    expect(await screen.findByText('Aún no hay productos. Crea el primero con el formulario.')).toBeInTheDocument()
    const form = screen.getByRole('region', { name: 'Nuevo producto' })
    expect(within(form).queryByLabelText('SKU')).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText('Categoría'), 'Ferretería')
    expect(within(form).getByText('FER-####')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Nombre'), 'Cemento gris 42.5 kg')
    await user.clear(within(form).getByLabelText('Unidad'))
    await user.type(within(form).getByLabelText('Unidad'), 'saco')
    await user.type(within(form).getByLabelText('Precio unitario (Q)'), '78')
    await user.clear(within(form).getByLabelText('Stock mínimo'))
    await user.type(within(form).getByLabelText('Stock mínimo'), '20')
    await user.selectOptions(within(form).getByLabelText('Bodega de la ubicación'), await screen.findByRole('option', { name: 'Bodega Central' }))
    await user.type(within(form).getByLabelText('Ubicación en bodega'), 'A-03-2')
    await user.click(within(form).getByRole('button', { name: 'Crear producto' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Producto FER-0001 creado')
    expect(within(screen.getByRole('region', { name: 'Productos' })).getByText('FER-0001')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      categoria: 'Ferretería', nombre: 'Cemento gris 42.5 kg', unidad: 'saco', precio_unitario: 78, stock_minimo: 20, peso_kg: 0, bodega_id: BODEGA_ID, ubicacion: 'A-03-2',
    })
  })

  it('edita el precio y desactiva un producto con PATCH', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [] }
      if (url.includes('/productos?')) return { status: 200, body: [creado] }
      if (url.endsWith(`/productos/${PRODUCTO_ID}`) && init?.method === 'PATCH') return { status: 200, body: { ...creado, precio_unitario: 80, activo: false } }
      return { status: 500, body: { statusCode: 500, message: `no esperado ${url}`, error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(await screen.findByRole('button', { name: 'Editar FER-0001' }))
    const form = screen.getByRole('region', { name: 'Editar producto' })
    expect(within(form).getByText('FER-0001')).toBeInTheDocument()
    await user.clear(within(form).getByLabelText('Precio unitario (Q)'))
    await user.type(within(form).getByLabelText('Precio unitario (Q)'), '80')
    await user.click(within(form).getByLabelText('Activo para la venta'))
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
    const patch = red.llamadas.find((llamada) => llamada.init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.init?.body))).toMatchObject({ precio_unitario: 80, activo: false })
  })

  it('registra un proveedor', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((url, init) => {
      if (url.endsWith('/proveedores') && init?.method === 'POST') return { status: 201, body: { id: PROVEEDOR_ID, nombre: 'Cementos Progreso', nit: '123-4' } }
      if (url.endsWith('/proveedores')) return { status: 200, body: [] }
      return { status: 200, body: [] }
    }))
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(screen.getByRole('button', { name: 'Proveedores' }))
    const form = screen.getByRole('region', { name: 'Nuevo proveedor' })
    await user.type(within(form).getByLabelText('Nombre'), 'Cementos Progreso')
    await user.type(within(form).getByLabelText('NIT'), '123-4')
    await user.click(within(form).getByRole('button', { name: 'Guardar proveedor' }))
    expect(await within(screen.getByRole('region', { name: 'Proveedores' })).findByText('Cementos Progreso')).toBeInTheDocument()
  })

  it('el proveedor guarda dirección y ubicación solo si se agregan', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.includes('nominatim.openstreetmap.org/search')) {
        return { status: 200, body: [{ display_name: 'Zona 3, Quetzaltenango', lat: '14.84', lon: '-91.52', address: { suburb: 'Zona 3', city: 'Quetzaltenango' } }] }
      }
      if (url.endsWith('/proveedores') && init?.method === 'POST') return { status: 201, body: { id: PROVEEDOR_ID, nombre: 'Aceros del Sur', direccion: 'Zona 3, Quetzaltenango' } }
      return { status: 200, body: [] }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(screen.getByRole('button', { name: 'Proveedores' }))
    const form = screen.getByRole('region', { name: 'Nuevo proveedor' })
    expect(within(form).queryByLabelText('Buscar dirección')).not.toBeInTheDocument()
    await user.type(within(form).getByLabelText('Nombre'), 'Aceros del Sur')
    await user.click(within(form).getByRole('button', { name: 'Agregar ubicación en el mapa (opcional)' }))
    await user.type(within(form).getByLabelText('Buscar dirección'), 'zona 3 xela')
    await user.click(within(form).getByRole('button', { name: 'Buscar' }))
    await user.click(await within(form).findByRole('button', { name: 'Zona 3, Quetzaltenango' }))
    await user.click(within(form).getByRole('button', { name: 'Guardar proveedor' }))
    expect(await within(screen.getByRole('region', { name: 'Proveedores' })).findByText('Zona 3, Quetzaltenango')).toBeInTheDocument()
    const post = red.llamadas.find((l) => l.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({ nombre: 'Aceros del Sur', direccion: 'Zona 3, Quetzaltenango', latitud: 14.84, longitud: -91.52 })
  })

  it('registra un vehículo y lo desactiva', async () => {
    const user = userEvent.setup()
    const VEH = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/vehiculos') && init?.method === 'POST') return { status: 201, body: { id: VEH, nombre: 'Camión 03', placa: 'C-123ABC', capacidad_kg: 3500, activo: true } }
      if (url.endsWith(`/vehiculos/${VEH}`) && init?.method === 'PATCH') return { status: 200, body: { id: VEH, nombre: 'Camión 03', placa: 'C-123ABC', capacidad_kg: 3500, activo: false } }
      return { status: 200, body: [] }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(screen.getByRole('button', { name: 'Vehículos' }))
    const form = screen.getByRole('region', { name: 'Nuevo vehículo' })
    await user.type(within(form).getByLabelText('Nombre'), 'Camión 03')
    await user.type(within(form).getByLabelText('Placa'), 'c-123abc')
    await user.type(within(form).getByLabelText('Capacidad (kg)'), '3500')
    await user.click(within(form).getByRole('button', { name: 'Guardar vehículo' }))
    await user.click(await screen.findByRole('button', { name: 'Desactivar Camión 03' }))
    expect(await screen.findByText('Inactivo')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({ nombre: 'Camión 03', placa: 'c-123abc', capacidad_kg: 3500 })
    expect(red.llamadas.some((llamada) => llamada.url.endsWith('/vehiculos?incluir_inactivos=true'))).toBe(true)
  })

  it('el despachador registra conductores desde Despacho › Flota', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((url, init) => {
      if (url.endsWith('/conductores') && init?.method === 'POST') return { status: 201, body: { id: 'c-1', nombre: 'Ana López', telefono: '5555-1234', activo: true } }
      return { status: 200, body: [] }
    }))
    renderConSesion(<App />, 'despachador', '/despachos/flota')
    await user.click(screen.getByRole('button', { name: 'Conductores' }))
    const form = screen.getByRole('region', { name: 'Nuevo conductor' })
    await user.type(within(form).getByLabelText('Nombre'), 'Ana López')
    await user.type(within(form).getByLabelText('Teléfono'), '5555-1234')
    await user.click(within(form).getByRole('button', { name: 'Guardar conductor' }))
    expect(await within(screen.getByRole('region', { name: 'Conductores' })).findByText('Ana López')).toBeInTheDocument()
  })

  it('el asesor no entra al catálogo', () => {
    renderConSesion(<App />, 'asesor_ventas', '/catalogo')
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes acceso a este módulo.')
  })
})
