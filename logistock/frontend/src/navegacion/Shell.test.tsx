import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { App } from '../App'
import type { Rol } from '../dominio/tipos'
import { renderConSesion } from '../test/renderConSesion'
import { Inicio } from './Inicio'
import { Shell } from './Shell'

const VISIBLES: Record<Rol, string[]> = {
  administrador: ['Pedidos', 'Inventario', 'Picking', 'Despacho', 'Reportes', 'Catálogo'],
  asesor_ventas: ['Pedidos', 'Inventario'],
  operario_bodega: ['Inventario', 'Picking'],
  despachador: ['Picking', 'Despacho'],
}

describe('shell PU-03', () => {
  it('cada rol ve solo sus módulos', () => {
    for (const rol of Object.keys(VISIBLES) as Rol[]) {
      const vista = renderConSesion(<Shell><p>contenido secreto</p></Shell>, rol, '/pedidos')
      const nav = screen.getByRole('navigation', { name: 'Módulos' })
      const nombres = within(nav).getAllByRole('link').map((enlace) => enlace.textContent)
      expect(nombres).toEqual(VISIBLES[rol])
      vista.unmount()
    }
  })

  it('muestra el rol, la bodega y las migas', () => {
    renderConSesion(<Shell><p>contenido secreto</p></Shell>, 'asesor_ventas', '/pedidos')
    expect(screen.getByText('Asesor de ventas')).toBeInTheDocument()
    expect(screen.getByText('Bodega Central')).toBeInTheDocument()
    expect(screen.getByText('Ventas / Pedidos / Nuevo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('el asesor no monta el contenido de reportes', () => {
    renderConSesion(<Shell><p>contenido secreto</p></Shell>, 'asesor_ventas', '/reportes')
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes acceso a este módulo.')
    expect(screen.queryByText('contenido secreto')).not.toBeInTheDocument()
  })

  it('el administrador sí monta reportes', () => {
    renderConSesion(<App />, 'administrador', '/reportes')
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
  })

  it('la ruta de entrada es el primer módulo del rol', () => {
    const casos: { rol: Rol; destino: string }[] = [
      { rol: 'asesor_ventas', destino: 'Destino pedidos' },
      { rol: 'operario_bodega', destino: 'Destino picking' },
      { rol: 'despachador', destino: 'Destino despachos' },
      { rol: 'administrador', destino: 'Destino reportes' },
    ]
    for (const caso of casos) {
      const vista = renderConSesion(
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/pedidos" element={<p>Destino pedidos</p>} />
          <Route path="/inventario" element={<p>Destino inventario</p>} />
          <Route path="/picking" element={<p>Destino picking</p>} />
          <Route path="/despachos" element={<p>Destino despachos</p>} />
          <Route path="/reportes" element={<p>Destino reportes</p>} />
        </Routes>,
        caso.rol,
        '/',
      )
      expect(screen.getByText(caso.destino)).toBeInTheDocument()
      vista.unmount()
    }
  })

  it('cerrar sesión vuelve al formulario de entrada', async () => {
    const user = userEvent.setup()
    renderConSesion(<App />, 'asesor_ventas', '/pedidos')
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})
