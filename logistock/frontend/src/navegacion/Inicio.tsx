import { Navigate } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { modulosDe } from './modulos'

export function Inicio() {
  const { usuario } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={modulosDe(usuario.rol)[0].ruta} replace />
}
