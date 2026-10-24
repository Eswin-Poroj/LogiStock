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
  const [recuperar, setRecuperar] = useState(false)

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
    <div className="login-pagina">
      <section className="login-marca">
        <p className="shell-logo"><span>LS</span> LogiStock</p>
        <div>
          <h1>Inventario, picking y rutas en un solo lugar</h1>
          <p>Reserva stock sin choques entre asesores y despacha con la ruta más corta.</p>
        </div>
        <p className="login-pie">Proyecto de Análisis de Sistemas II · UMG Quetzaltenango</p>
      </section>
      <section className="login-panel">
        <form className="login-tarjeta" onSubmit={(evento) => void enviar(evento)}>
          <h2>Iniciar sesión</h2>
          <p>Ingresa con tu cuenta de la empresa.</p>
          {error && <AvisoApi error={error} />}
          <label>
            Correo electrónico
            <input type="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" value={clave} onChange={(evento) => setClave(evento.target.value)} />
          </label>
          <button type="submit" className="boton-primario">Entrar</button>
          <button type="button" className="login-olvido" onClick={() => setRecuperar(true)}>¿Olvidaste tu contraseña?</button>
          {recuperar && <p role="status">La recuperación de contraseña no está en la API. Pide el restablecimiento al administrador.</p>}
        </form>
      </section>
    </div>
  )
}
