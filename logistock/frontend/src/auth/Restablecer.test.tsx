import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Restablecer, tokenDeRecuperacion } from './Restablecer'
import { instalarFetch } from '../test/mockFetch'

describe('restablecer contraseña', () => {
  const redes: { restaurar(): void }[] = []
  afterEach(() => {
    for (const red of redes) red.restaurar()
    window.location.hash = ''
  })

  it('lee el token solo si el enlace es de recuperación', () => {
    expect(tokenDeRecuperacion('#access_token=abc&type=recovery')).toBe('abc')
    expect(tokenDeRecuperacion('#access_token=abc&type=signup')).toBeNull()
    expect(tokenDeRecuperacion('')).toBeNull()
  })

  it('sin token avisa que el enlace no sirve', () => {
    render(<MemoryRouter><Restablecer /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace no es válido o ya se usó')
  })

  it('envía la contraseña nueva con el token del enlace', async () => {
    const user = userEvent.setup()
    window.location.hash = '#access_token=tok-123&type=recovery'
    const red = instalarFetch(() => ({ status: 200, body: { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' } }))
    redes.push(red)
    render(<MemoryRouter><Restablecer /></MemoryRouter>)
    await user.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave1')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'NuevaClave2')
    expect(screen.getByRole('button', { name: 'Guardar contraseña' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Repite la contraseña'))
    await user.type(screen.getByLabelText('Repite la contraseña'), 'NuevaClave1')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada')
    expect(JSON.parse(String(red.llamadas[0].init?.body))).toEqual({ access_token: 'tok-123', clave: 'NuevaClave1' })
  })
})
