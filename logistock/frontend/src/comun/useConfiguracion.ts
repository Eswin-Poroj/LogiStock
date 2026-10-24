import { useEffect, useState } from 'react'
import { api } from '../api/cliente'

export interface Configuracion { iva_pct: number; descuento_max_pct: number; ajuste_max_pct: number }

/** Valores del backend; mientras llegan se usan los mismos que trae por defecto. */
const POR_DEFECTO: Configuracion = { iva_pct: 12, descuento_max_pct: 10, ajuste_max_pct: 20 }

export function useConfiguracion(token: string | null): Configuracion {
  const [config, setConfig] = useState<Configuracion>(POR_DEFECTO)
  useEffect(() => {
    if (!token) return
    let vivo = true
    api<Configuracion>('/configuracion', { token })
      .then((dato) => { if (vivo && dato && typeof dato.descuento_max_pct === 'number') setConfig(dato) })
      .catch(() => { /* se queda con los valores por defecto */ })
    return () => { vivo = false }
  }, [token])
  return config
}
