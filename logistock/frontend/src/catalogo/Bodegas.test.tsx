import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { resumenTarjeta } from '../picking/TableroPicking'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID } from '../test/ids'

describe('bodegas', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('crea una bodega con su ubicación marcada desde la búsqueda', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.includes('nominatim.openstreetmap.org/search')) {
        return { status: 200, body: [{ display_name: 'Calzada Sinforoso Aguilar, Zona 7, Quetzaltenango', lat: '14.8601', lon: '-91.5202', address: { road: 'Calzada Sinforoso Aguilar', suburb: 'Zona 7', city: 'Quetzaltenango' } }] }
      }
      if (url.endsWith('/bodegas') && init?.method === 'POST') return { status: 201, body: { id: BODEGA_ID, nombre: 'Bodega Norte', direccion: 'Calzada Sinforoso Aguilar, Zona 7, Quetzaltenango', latitud: 14.8601, longitud: -91.5202, activa: true } }
      return { status: 200, body: [] }
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/catalogo')
    await user.click(screen.getByRole('button', { name: 'Bodegas' }))
    const form = screen.getByRole('region', { name: 'Nueva bodega' })
    expect(within(form).getByRole('button', { name: 'Crear bodega' })).toBeDisabled()
    await user.type(within(form).getByLabelText('Nombre'), 'Bodega Norte')
    await user.type(within(form).getByLabelText('Buscar dirección'), 'Calzada Sinforoso Aguilar')
    await user.click(within(form).getByRole('button', { name: 'Buscar' }))
    await user.click(await within(form).findByRole('button', { name: 'Calzada Sinforoso Aguilar, Zona 7, Quetzaltenango' }))
    await user.click(within(form).getByRole('button', { name: 'Crear bodega' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Bodega Bodega Norte creada')
    expect(within(screen.getByRole('region', { name: 'Bodegas' })).getByText('14.8601, -91.5202')).toBeInTheDocument()
    const post = red.llamadas.find((llamada) => llamada.init?.method === 'POST')
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      nombre: 'Bodega Norte', latitud: 14.8601, longitud: -91.5202, direccion: 'Calzada Sinforoso Aguilar, Zona 7, Quetzaltenango',
    })
  })
})

describe('tarjetas del tablero', () => {
  it('muestran líneas y total como en la figura 7', () => {
    expect(resumenTarjeta(2, 2940)).toBe('2 líneas · Q 2,940.00')
    expect(resumenTarjeta(1, undefined)).toBe('1 línea')
    expect(resumenTarjeta(undefined, 100)).toBe('Q 100.00')
  })
})
