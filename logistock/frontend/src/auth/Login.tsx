import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AvisoApi } from '../api/AvisoApi'
import { ApiError } from '../api/cliente'
import type { Rol } from '../dominio/tipos'
import { CLAVE_USUARIO, useSesion } from './sesion'

const OPCIONES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'asesor_ventas', etiqueta: 'Asesor de ventas' },
  { valor: 'operario_bodega', etiqueta: 'Operario de bodega' },
  { valor: 'despachador', etiqueta: 'Despachador' },
  { valor: 'administrador', etiqueta: 'Administrador' },
]

export function Login() {
  const { entrar, salir, usuario } = useSesion()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [rol, setRol] = useState<Rol>('asesor_ventas')
  const [error, setError] = useState<ApiError | null>(null)
  const [avisoRol, setAvisoRol] = useState<string | null>(null)
  const [recuperar, setRecuperar] = useState(false)
  const [confirmado, setConfirmado] = useState(() => usuario !== null)

  if (usuario && confirmado) return <Navigate to="/" replace />

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setError(null)
    setAvisoRol(null)
    try {
      await entrar(correo, clave)
      const crudo = sessionStorage.getItem(CLAVE_USUARIO)
      const perfil = crudo ? JSON.parse(crudo) as { rol: Rol } : null
      if (perfil && perfil.rol !== rol) {
        salir()
        setAvisoRol('El rol de la cuenta no coincide con el seleccionado.')
        return
      }
      setConfirmado(true)
    } catch (fallo) {
      if (fallo instanceof ApiError) setError(fallo)
    }
  }

  return (
    <div className="login-pagina">
      <section className="login-marca">
        <p className="shell-logo"><span>LS</span> LogiStock</p>
        <h1>Inventario, picking y rutas en un solo lugar</h1>
        <p>Reserva stock sin choques entre asesores y despacha con la ruta más corta.</p>
        <p className="login-pie">Proyecto de Análisis de Sistemas II · UMG Quetzaltenango</p>
      </section>
      <section className="login-panel">
        <form className="login-tarjeta" onSubmit={(evento) => void enviar(evento)}>
          <h2>Iniciar sesión</h2>
          <p>Ingresa con tu cuenta de la empresa.</p>
          {error && <AvisoApi error={error} />}
          {avisoRol && <p role="alert" className="aviso-api aviso-api--error">{avisoRol}</p>}
          <label>
            Correo electrónico
            <input type="email" value={correo} onChange={(evento) => setCorreo(evento.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" value={clave} onChange={(evento) => setClave(evento.target.value)} />
          </label>
          <label>
            Rol
            <select value={rol} onChange={(evento) => setRol(evento.target.value as Rol)}>
              {OPCIONES.map((opcion) => <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>)}
            </select>
          </label>
          <button type="submit" className="boton-primario">Entrar</button>
          <button type="button" className="login-olvido" onClick={() => setRecuperar(true)}>¿Olvidaste tu contraseña?</button>
          {recuperar && <p role="status">La recuperación de contraseña no está en la API. Pide el restablecimiento al administrador.</p>}
        </form>
      </section>
    </div>
  )
}
