import type { Rol } from '../dominio/tipos'

export interface Modulo {
  id: 'pedidos' | 'inventario' | 'picking' | 'despachos' | 'reportes'
  etiqueta: 'Pedidos' | 'Inventario' | 'Picking' | 'Despachos' | 'Reportes'
  ruta: '/pedidos' | '/inventario' | '/picking' | '/despachos' | '/reportes'
  roles: readonly Rol[]
}

export const MODULOS: readonly Modulo[] = [
  { id: 'pedidos', etiqueta: 'Pedidos', ruta: '/pedidos', roles: ['asesor_ventas', 'administrador'] },
  { id: 'inventario', etiqueta: 'Inventario', ruta: '/inventario', roles: ['operario_bodega', 'administrador'] },
  { id: 'picking', etiqueta: 'Picking', ruta: '/picking', roles: ['operario_bodega', 'despachador', 'administrador'] },
  { id: 'despachos', etiqueta: 'Despachos', ruta: '/despachos', roles: ['despachador', 'administrador'] },
  { id: 'reportes', etiqueta: 'Reportes', ruta: '/reportes', roles: ['administrador'] },
]

export function modulosDe(rol: Rol): readonly Modulo[] {
  return MODULOS.filter((modulo) => modulo.roles.includes(rol))
}

export function moduloDeRuta(pathname: string): Modulo | undefined {
  const ordenados = [...MODULOS].sort((a, b) => b.ruta.length - a.ruta.length)
  return ordenados.find((modulo) => pathname === modulo.ruta || pathname.startsWith(`${modulo.ruta}/`))
}
