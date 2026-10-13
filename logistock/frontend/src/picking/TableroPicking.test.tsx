import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { PEDIDO_ID, TAREA_ID } from '../test/ids'

const tarea = {
  id: TAREA_ID,
  pedido_id: PEDIDO_ID,
  estado: 'pendiente',
  numero_pedido: 'PED-000233',
  cliente: 'Ferretería La Esquina',
  lineas: [],
}

describe('tablero de picking', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('con 501 deja las columnas en cero y no inventa un pedido', async () => {
    const red = instalarFetch((url) => {
      if (url.includes('/pedidos?estado=')) return { status: 200, body: [] }
      expect(url.endsWith('/picking/tareas')).toBe(true)
      return { status: 501, body: { statusCode: 501, message: 'Pendiente: Iteración 3', error: 'Not Implemented' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/picking')
    expect(await screen.findByRole('heading', { name: 'Preparación de pedidos' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente: Iteración 3')
    expect(screen.queryByText('PED-000231')).not.toBeInTheDocument()
    expect(screen.queryByText('PED-000233')).not.toBeInTheDocument()
    for (const titulo of ['Creado', 'En preparación', 'Despachado', 'Entregado']) {
      expect(within(screen.getByRole('region', { name: titulo })).getByText('0')).toBeInTheDocument()
    }
  })

  it('coloca la tarea pendiente en Creado y enlaza la tarea', async () => {
    const red = instalarFetch((url) => {
      if (url.endsWith('/picking/tareas')) return { status: 200, body: [tarea] }
      if (url.includes('/pedidos?estado=despachado')) {
        return { status: 200, body: [{ id: PEDIDO_ID, numero: 'PED-000226', cliente: 'Materiales del Valle', estado: 'despachado', total: 10, created_at: '2026-10-12T00:00:00.000Z' }] }
      }
      if (url.includes('/pedidos?estado=entregado')) return { status: 200, body: [] }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/picking')
    const creado = await screen.findByRole('region', { name: 'Creado' })
    expect(within(creado).getByText('PED-000233')).toBeInTheDocument()
    expect(within(creado).getByText('Ferretería La Esquina')).toBeInTheDocument()
    expect(within(creado).getByRole('link', { name: /PED-000233/ })).toHaveAttribute('href', `/picking/tarea?id=${TAREA_ID}`)
    expect(within(screen.getByRole('region', { name: 'Despachado' })).getByText('PED-000226')).toBeInTheDocument()
    expect(screen.queryByText(/2 líneas/)).not.toBeInTheDocument()
    expect(screen.queryByText('R-14')).not.toBeInTheDocument()
  })
})
