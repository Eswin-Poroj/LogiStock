import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { BODEGA_ID, DESPACHO_ID, PRODUCTO_ID } from '../test/ids'

function cuerpo(mensaje: string) {
  return { status: 501, body: { statusCode: 501, message: mensaje, error: 'Not Implemented' } }
}

describe('pantallas 501', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('los tres reportes muestran Pendiente y ninguna cifra inventada', async () => {
    const red = instalarFetch((url) => {
      expect(['/reportes/resumen', '/reportes/mas-vendidos', '/reportes/alertas-stock'].some((ruta) => url.endsWith(ruta))).toBe(true)
      return cuerpo('Pendiente')
    })
    redes.push(red)
    renderConSesion(<App />, 'administrador', '/reportes')
    for (const titulo of ['Resumen', 'Más vendidos', 'Alertas de stock']) {
      const region = await screen.findByRole('region', { name: titulo })
      expect(within(region).getByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente')
      expect(region.textContent).not.toMatch(/entregas a tiempo/i)
      expect(region.textContent).not.toMatch(/rotaci/i)
    }
    expect(screen.queryByText('FER-0012')).not.toBeInTheDocument()
  })

  it('el tablero de picking muestra el 501 y no una tarea', async () => {
    const red = instalarFetch((url) => {
      expect(url.endsWith('/picking/tareas')).toBe(true)
      return cuerpo('Pendiente: Iteración 3')
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/picking')
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 3')
    expect(screen.queryByText('PED-000231')).not.toBeInTheDocument()
  })

  it('el listado de despachos muestra el 501 y no un código de ruta', async () => {
    const red = instalarFetch(() => cuerpo('Pendiente: Iteración 3'))
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos')
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 3')
    expect(screen.queryByText('R-14')).not.toBeInTheDocument()
  })

  it('iniciar ruta muestra el 501 y no pasa el despacho a en_ruta', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      expect(url).toContain(`/despachos/${DESPACHO_ID}/iniciar`)
      expect(init?.method).toBe('POST')
      return cuerpo('Pendiente: Iteración 3')
    })
    redes.push(red)
    renderConSesion(<App />, 'despachador', '/despachos/iniciar')
    fireEvent.change(screen.getByLabelText('Despacho'), { target: { value: DESPACHO_ID } })
    await user.click(screen.getByRole('button', { name: 'Iniciar ruta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 3')
    expect(screen.queryByText('en_ruta')).not.toBeInTheDocument()
  })

  it('el ajuste positivo muestra el 501 y no un disponible inventado', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ tipo: 'ajuste', cantidad: 4, producto_id: PRODUCTO_ID, bodega_id: BODEGA_ID })
      expect(url.endsWith('/inventario/ajustes')).toBe(true)
      return cuerpo('Pendiente: Iteración 2')
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/inventario/ajustes')
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: PRODUCTO_ID } })
    fireEvent.change(screen.getByLabelText('Bodega'), { target: { value: BODEGA_ID } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 2')
    expect(screen.queryByText(/Disponible:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Movimiento /)).not.toBeInTheDocument()
    expect(screen.queryByText('Stock actualizado')).not.toBeInTheDocument()
  })
})
