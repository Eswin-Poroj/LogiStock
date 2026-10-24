import { cleanup, render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CLAVE_TOKEN, CLAVE_USUARIO, SesionProvider } from '../auth/sesion'
import type { Rol, Usuario } from '../dominio/tipos'
import { BODEGA_ID, USUARIO_ID } from './ids'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

export function renderConSesion(ui: ReactElement, rol: Rol, ruta = '/') {
  const usuario: Usuario = { id: USUARIO_ID, nombre: 'Ada', rol, bodega_id: BODEGA_ID, bodega_nombre: 'Bodega Central' }
  sessionStorage.setItem(CLAVE_TOKEN, 'token-prueba')
  sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
  return render(
    <SesionProvider>
      <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
    </SesionProvider>,
  )
}
