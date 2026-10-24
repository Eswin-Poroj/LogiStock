import type { Rol } from '../dominio/tipos'

export type AccesoModulo = 'escritura' | 'lectura'

export interface Modulo {
  id: 'pedidos' | 'inventario' | 'picking' | 'despachos' | 'reportes' | 'catalogo'
  etiqueta: 'Pedidos' | 'Inventario' | 'Picking' | 'Despacho' | 'Reportes' | 'Catálogo'
  ruta: '/pedidos' | '/inventario' | '/picking' | '/despachos' | '/reportes' | '/catalogo'
  acceso: Readonly<Partial<Record<Rol, AccesoModulo>>>
}

export const MODULOS: readonly Modulo[] = [
  { id: 'pedidos', etiqueta: 'Pedidos', ruta: '/pedidos', acceso: { asesor_ventas: 'escritura', administrador: 'escritura' } },
  { id: 'inventario', etiqueta: 'Inventario', ruta: '/inventario', acceso: { asesor_ventas: 'lectura', operario_bodega: 'escritura', administrador: 'escritura' } },
  { id: 'picking', etiqueta: 'Picking', ruta: '/picking', acceso: { operario_bodega: 'escritura', despachador: 'lectura', administrador: 'escritura' } },
  { id: 'despachos', etiqueta: 'Despacho', ruta: '/despachos', acceso: { despachador: 'escritura', administrador: 'escritura' } },
  { id: 'reportes', etiqueta: 'Reportes', ruta: '/reportes', acceso: { administrador: 'escritura' } },
  // Visión: el administrador gestiona bodegas y el catálogo maestro (productos, proveedores, clientes).
  { id: 'catalogo', etiqueta: 'Catálogo', ruta: '/catalogo', acceso: { administrador: 'escritura' } },
]

export function modulosDe(rol: Rol): readonly Modulo[] {
  return MODULOS.filter((modulo) => modulo.acceso[rol] !== undefined)
}

export function accesoDe(rol: Rol, id: Modulo['id']): AccesoModulo | 'ninguno' {
  return MODULOS.find((modulo) => modulo.id === id)?.acceso[rol] ?? 'ninguno'
}

export function moduloDeRuta(pathname: string): Modulo | undefined {
  const ordenados = [...MODULOS].sort((a, b) => b.ruta.length - a.ruta.length)
  return ordenados.find((modulo) => pathname === modulo.ruta || pathname.startsWith(`${modulo.ruta}/`))
}
