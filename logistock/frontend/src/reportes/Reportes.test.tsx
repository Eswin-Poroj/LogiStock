import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { instalarFetch } from '../test/mockFetch'
import { renderConSesion } from '../test/renderConSesion'

const resumenOk = {
  pedidos_despachados: 2,
  entregas_a_tiempo_pct: 50,
  rotacion: 1.5,
  pedidos_backorder: 1,
  despachos_por_dia: [{ etiqueta: 'Lun', cantidad: 2 }],
}

const vendidosOk = [{ sku: 'FER-0012', producto: 'Cemento gris 42.5 kg', unidades: 4 }]
const alertasOk = [{ sku: 'PIN-0207', producto: 'Pintura', disponible: 18, estado: 'reponer' }]

function pendiente() {
  return { status: 501, body: { statusCode: 501, message: 'Pendiente', error: 'Not Implemented' } }
}

describe('reportes', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => { for (const red of redes) red.restaurar() })

  it('con 501 no pinta cifras de ejemplo y deja la exportación apagada', async () => {
    redes.push(instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [] }
      return pendiente()
    }))
    renderConSesion(<App />, 'administrador', '/reportes')
    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Resumen operativo' })).toBeInTheDocument()
    for (const titulo of ['Resumen', 'Más vendidos', 'Alertas de stock']) {
      const region = await screen.findByRole('region', { name: titulo })
      expect(within(region).getByRole('alert')).toHaveTextContent('El servicio respondió 501: Pendiente')
    }
    expect(screen.queryByText('475')).not.toBeInTheDocument()
    expect(screen.queryByText('94 %')).not.toBeInTheDocument()
    expect(screen.queryByText('3.8x')).not.toBeInTheDocument()
    expect(screen.queryByText('FER-0012')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar a Excel' })).toBeDisabled()
  })

  it('pinta el contrato 200 y habilita la exportación', async () => {
    redes.push(instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [] }
      if (url.endsWith('/reportes/resumen')) return { status: 200, body: resumenOk }
      if (url.endsWith('/reportes/mas-vendidos')) return { status: 200, body: vendidosOk }
      if (url.endsWith('/reportes/alertas-stock')) return { status: 200, body: alertasOk }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    }))
    renderConSesion(<App />, 'administrador', '/reportes')
    expect(await screen.findByText('50 %')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('1.5x')).toBeInTheDocument()
    expect(screen.getByText('FER-0012')).toBeInTheDocument()
    expect(screen.getByText('Reponer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exportar a Excel' })).toBeEnabled()
  })

  it('avisa si el resumen no trae el formato y no inventa 475', async () => {
    redes.push(instalarFetch((url) => {
      if (url.endsWith('/bodegas')) return { status: 200, body: [] }
      if (url.endsWith('/reportes/resumen')) return { status: 200, body: { foo: 1 } }
      if (url.endsWith('/reportes/mas-vendidos')) return { status: 200, body: [] }
      if (url.endsWith('/reportes/alertas-stock')) return { status: 200, body: [] }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    }))
    renderConSesion(<App />, 'administrador', '/reportes')
    expect(await screen.findByText('El servicio no devolvió el formato esperado.')).toBeInTheDocument()
    expect(screen.queryByText('475')).not.toBeInTheDocument()
  })
})
