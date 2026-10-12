import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError } from '../api/cliente'
import { useSesion } from './sesion'

export function Login() {
  const { entrar, usuario } = useSesion()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  if (usuario) return <Navigate to="/" replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    try {
      await entrar(correo, clave)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <form onSubmit={(evento) => void enviar(evento)}>
      <h1>LogiStock</h1>
      <label>
        Correo
        <input type="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} />
      </label>
      <label>
        Clave
        <input type="password" value={clave} onChange={(evento) => setClave(evento.target.value)} />
      </label>
      <button type="submit">Entrar</button>
      {error && <AvisoApi error={error} />}
    </form>
  )
}
