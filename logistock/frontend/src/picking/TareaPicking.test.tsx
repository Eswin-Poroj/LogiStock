import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { PEDIDO_ID, TAREA_ID } from '../test/ids'

const linea = {
  pedido_linea_id: 'abababab-abab-4aba-8aba-abababababab',
  sku: 'FER-0012',
  nombre: 'Cemento gris 42.5 kg',
  cantidad: 2,
  cantidad_recogida: 1,
}

function tarea(parcial: Record<string, unknown> = {}) {
  return { id: TAREA_ID, pedido_id: PEDIDO_ID, estado: 'en_curso', lineas: [linea], ...parcial }
}

describe('tarea de picking', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('escanea, habilita listo para despacho y completa sin nota', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith(`/picking/tareas/${TAREA_ID}`) && (!init?.method || init.method === 'GET')) return { status: 200, body: tarea() }
      if (url.endsWith('/escaneos')) return { status: 200, body: tarea({ lineas: [{ ...linea, cantidad_recogida: 2 }] }) }
      if (url.endsWith('/completar')) return { status: 200, body: tarea({ estado: 'completado', lineas: [{ ...linea, cantidad_recogida: 2 }] }) }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', `/picking/tarea?id=${TAREA_ID}`)
    expect(await screen.findByText('En curso')).toBeInTheDocument()
    expect(screen.getByText(/FER-0012/)).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.queryByText('A-03-2')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tarea')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar como listo para despacho' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'FER-0012' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '1' } })
    await user.click(screen.getByRole('button', { name: 'Confirmar escaneo' }))
    expect(await screen.findByText('2 / 2')).toBeInTheDocument()
    const escaneo = red.llamadas.find((llamada) => llamada.url.endsWith('/escaneos'))
    expect(JSON.parse(String(escaneo?.init?.body))).toEqual({ sku: 'FER-0012', cantidad: 1 })
    await user.click(screen.getByRole('button', { name: 'Marcar como listo para despacho' }))
    expect(await screen.findByText('Completada')).toBeInTheDocument()
    const cierre = red.llamadas.find((llamada) => llamada.url.endsWith('/completar'))
    expect(JSON.parse(String(cierre?.init?.body))).toEqual({ faltante: false })
  })

  it('muestra el 409 del SKU ajeno y no cambia lo recogido', async () => {
    const user = userEvent.setup()
    redes.push(instalarFetch((url, init) => {
      if (init?.method === 'POST') return { status: 409, body: { statusCode: 409, message: 'El SKU FER-9999 no está en la tarea', error: 'Conflict' } }
      return { status: 200, body: tarea() }
    }))
    renderConSesion(<App />, 'operario_bodega', `/picking/tarea?id=${TAREA_ID}`)
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'FER-9999' } })
    await user.click(screen.getByRole('button', { name: 'Confirmar escaneo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 409: El SKU FER-9999 no está en la tarea')
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('reportar faltante envía faltante true y no envía nota', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/completar')) return { status: 200, body: tarea({ estado: 'con_faltante' }) }
      return { status: 200, body: tarea() }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', `/picking/tarea?id=${TAREA_ID}`)
    await user.click(await screen.findByRole('button', { name: 'Reportar faltante' }))
    expect(await screen.findByText('Con faltante')).toBeInTheDocument()
    const cierre = red.llamadas.find((llamada) => llamada.url.endsWith('/completar'))
    expect(JSON.parse(String(cierre?.init?.body))).toEqual({ faltante: true })
  })

  it('el despachador ve la línea y no los botones de escritura', async () => {
    redes.push(instalarFetch(() => ({ status: 200, body: tarea() })))
    renderConSesion(<App />, 'despachador', `/picking/tarea?id=${TAREA_ID}`)
    expect(await screen.findByText('FER-0012')).toBeInTheDocument()
    expect(screen.getByText('Picking es de solo lectura para tu rol.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar escaneo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reportar faltante' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como listo para despacho' })).not.toBeInTheDocument()
  })
})
