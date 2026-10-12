import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import { CLAVE_TOKEN, SesionProvider } from './sesion'
import { instalarFetch } from '../test/mockFetch'
import { BODEGA_ID, USUARIO_ID } from '../test/ids'

const usuario = { id: USUARIO_ID, nombre: 'Ada', rol: 'asesor_ventas' as const, bodega_id: BODEGA_ID }

function renderLogin() {
  return render(
    <SesionProvider>
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    </SesionProvider>,
  )
}

describe('login', () => {
  const redes: { restaurar(): void }[] = []

  afterEach(() => {
    for (const red of redes) red.restaurar()
    redes.length = 0
    sessionStorage.clear()
    cleanup()
  })

  it('guarda el token del login y el perfil de /auth/me', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url, init) => {
      if (url.endsWith('/auth/login')) {
        expect(JSON.parse(String(init?.body))).toEqual({ correo: 'ada@ejemplo.com', clave: 'secreta' })
        return { status: 200, body: { access_token: 'token-prueba', expira_en: 3600, usuario } }
      }
      if (url.endsWith('/auth/me')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-prueba' })
        return { status: 200, body: usuario }
      }
      return { status: 500, body: { statusCode: 500, message: 'no esperado', error: 'Error' } }
    })
    redes.push(red)
    renderLogin()
    await user.type(screen.getByLabelText('Correo'), 'ada@ejemplo.com')
    await user.type(screen.getByLabelText('Clave'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Sesión de Ada')).toBeInTheDocument()
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBe('token-prueba')
  })

  it('muestra el 401 y no guarda token', async () => {
    const user = userEvent.setup()
    const red = instalarFetch((url) => {
      if (url.endsWith('/auth/me')) return { status: 500, body: { statusCode: 500, message: 'no debía llamar me', error: 'Error' } }
      return { status: 401, body: { statusCode: 401, message: 'Credenciales incorrectas', error: 'Unauthorized' } }
    })
    redes.push(red)
    renderLogin()
    await user.type(screen.getByLabelText('Correo'), 'ada@ejemplo.com')
    await user.type(screen.getByLabelText('Clave'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio respondió 401: Credenciales incorrectas')
    expect(sessionStorage.getItem(CLAVE_TOKEN)).toBeNull()
    expect(red.llamadas.some((llamada) => llamada.url.endsWith('/auth/me'))).toBe(false)
  })
})
