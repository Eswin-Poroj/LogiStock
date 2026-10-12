import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api/cliente'
import type { LoginResponse, Usuario } from '../dominio/tipos'

export const CLAVE_TOKEN = 'logistock.access_token'
export const CLAVE_USUARIO = 'logistock.usuario'

export interface Sesion {
  token: string | null
  usuario: Usuario | null
  entrar: (correo: string, clave: string) => Promise<void>
  salir: () => void
}

const SesionContext = createContext<Sesion | null>(null)

function leerUsuario(): Usuario | null {
  const crudo = sessionStorage.getItem(CLAVE_USUARIO)
  if (!crudo) return null
  return JSON.parse(crudo) as Usuario
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(CLAVE_TOKEN))
  const [usuario, setUsuario] = useState<Usuario | null>(leerUsuario)

  async function entrar(correo: string, clave: string) {
    const sesion = await api<LoginResponse>('/auth/login', { method: 'POST', body: { correo, clave } })
    const yo = await api<Usuario>('/auth/me', { token: sesion.access_token })
    sessionStorage.setItem(CLAVE_TOKEN, sesion.access_token)
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(yo))
    setToken(sesion.access_token)
    setUsuario(yo)
  }

  function salir() {
    sessionStorage.removeItem(CLAVE_TOKEN)
    sessionStorage.removeItem(CLAVE_USUARIO)
    setToken(null)
    setUsuario(null)
  }

  return <SesionContext.Provider value={{ token, usuario, entrar, salir }}>{children}</SesionContext.Provider>
}

export function useSesion(): Sesion {
  const valor = useContext(SesionContext)
  if (!valor) throw new Error('useSesion fuera de SesionProvider')
  return valor
}
