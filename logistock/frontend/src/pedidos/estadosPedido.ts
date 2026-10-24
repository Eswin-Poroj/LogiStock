import type { EstadoPedido } from '../dominio/tipos'

export function etiquetaEstadoPedido(estado: EstadoPedido): string {
  if (estado === 'creado') return 'Creado'
  if (estado === 'en_preparacion') return 'En preparación'
  if (estado === 'despachado') return 'Despachado'
  if (estado === 'entregado') return 'Entregado'
  return 'Cancelado'
}

export function notaEstadoPedido(estado: EstadoPedido): string {
  if (estado === 'creado') return 'stock reservado'
  if (estado === 'en_preparacion') return 'picking en curso'
  if (estado === 'despachado') return 'asignado a una ruta'
  if (estado === 'entregado') return 'entregado al cliente'
  return 'stock liberado'
}

export function puedeCancelarPedido(rol: string, estado: EstadoPedido): boolean {
  const rolOk = rol === 'asesor_ventas' || rol === 'administrador'
  return rolOk && (estado === 'creado' || estado === 'en_preparacion')
}
