import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'
import { TAREA_ID } from '../test/ids'

const tarea = {
  id: TAREA_ID,
  pedido_id: '99999999-9999-4999-8999-999999999999',
  estado: 'en_curso',
  lineas: [{
    pedido_linea_id: 'abababab-abab-4aba-8aba-abababababab',
    sku: 'FER-0012',
    nombre: 'Cemento gris 42.5 kg',
    cantidad: 2,
    cantidad_recogida: 1,
  }],
}

describe('tarea de picking', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('carga por id, escanea y completa con los campos que devuelve la API', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith(`/picking/tareas/${TAREA_ID}`) && (!init?.method || init.method === 'GET')) return { status: 200, body: tarea }
      if (url.endsWith('/escaneos')) return { status: 200, body: { ...tarea, lineas: [{ ...tarea.lineas[0], cantidad_recogida: 2 }] } }
      if (url.endsWith('/completar')) return { status: 200, body: { ...tarea, estado: 'completado', lineas: [{ ...tarea.lineas[0], cantidad_recogida: 2 }] } }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderConSesion(<App />, 'operario_bodega', '/picking/tarea')
    fireEvent.change(screen.getByLabelText('Tarea'), { target: { value: TAREA_ID } })
    await user.click(screen.getByRole('button', { name: 'Cargar tarea' }))
    expect(await screen.findByText(/FER-0012/)).toBeInTheDocument()
    expect(screen.getByText(/Cemento gris 42.5 kg/)).toBeInTheDocument()
    expect(screen.queryByText('A-03-2')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'FER-0012' } })
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '1' } })
    await user.click(screen.getByRole('button', { name: 'Registrar escaneo' }))
    const escaneo = red.llamadas.find((llamada) => llamada.url.endsWith('/escaneos'))
    expect(JSON.parse(String(escaneo?.init?.body))).toEqual({ sku: 'FER-0012', cantidad: 1 })
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Falta una caja' } })
    await user.click(screen.getByLabelText('Faltante'))
    await user.click(screen.getByRole('button', { name: 'Completar' }))
    const cierre = red.llamadas.find((llamada) => llamada.url.endsWith('/completar'))
    expect(JSON.parse(String(cierre?.init?.body))).toEqual({ faltante: true, nota: 'Falta una caja' })
    expect(await screen.findByText('Estado completado')).toBeInTheDocument()
    expect(red.llamadas.some((llamada) => llamada.url.endsWith('/picking/tareas'))).toBe(false)
  })
})
