import { Navigate } from 'react-router-dom'
import { useSesion } from '../auth/sesion'
import { INICIO_POR_ROL } from './roles'

export function Inicio() {
  const { usuario } = useSesion()
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />
}
