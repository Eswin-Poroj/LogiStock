import type { Rol } from '../dominio/tipos'

export function etiquetaRol(rol: Rol): 'Asesor de ventas' | 'Operario de bodega' | 'Despachador' | 'Administrador' {
  if (rol === 'asesor_ventas') return 'Asesor de ventas'
  if (rol === 'operario_bodega') return 'Operario de bodega'
  if (rol === 'despachador') return 'Despachador'
  return 'Administrador'
}

export const INICIO_POR_ROL: Record<Rol, '/pedidos' | '/picking' | '/despachos' | '/reportes'> = {
  asesor_ventas: '/pedidos',
  operario_bodega: '/picking',
  despachador: '/despachos',
  administrador: '/reportes',
}
