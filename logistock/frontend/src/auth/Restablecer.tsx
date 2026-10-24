import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError, api } from '../api/cliente'

/** Token que Supabase Auth deja en el fragmento del enlace de recuperación (#access_token=…&type=recovery). */
export function tokenDeRecuperacion(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.get('type') === 'recovery' ? params.get('access_token') : null
}

export function Restablecer() {
  const [token] = useState(() => tokenDeRecuperacion(window.location.hash))
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [listo, setListo] = useState<string | null>(null)
  const valida = clave.length >= 8 && clave === repetida

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!token || !valida) return
    setError(null)
    try {
      const respuesta = await api<{ mensaje: string }>('/auth/restablecer', { method: 'POST', body: { access_token: token, clave } })
      setListo(respuesta.mensaje)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <div className="login-pagina">
      <section className="login-marca">
        <p className="shell-logo"><span>LS</span> LogiStock</p>
      </section>
      <section className="login-panel">
        <form className="login-tarjeta" onSubmit={(evento) => void enviar(evento)}>
          <h2>Nueva contraseña</h2>
          {!token && <p role="alert">El enlace no es válido o ya se usó. Pide uno nuevo desde Iniciar sesión.</p>}
          {error && <AvisoApi error={error} />}
          {listo
            ? <p role="status" className="nota-ok">{listo}</p>
            : token && (
              <>
                <label>Contraseña nueva<input type="password" value={clave} onChange={(e) => setClave(e.target.value)} /></label>
                <label>Repite la contraseña<input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} /></label>
                {clave.length > 0 && clave.length < 8 && <p className="nota">Usa al menos 8 caracteres.</p>}
                {repetida.length > 0 && clave !== repetida && <p className="nota">Las contraseñas no coinciden.</p>}
                <button type="submit" className="boton-primario" disabled={!valida}>Guardar contraseña</button>
              </>
            )}
          <Link to="/login">Volver a iniciar sesión</Link>
        </form>
      </section>
    </div>
  )
}
