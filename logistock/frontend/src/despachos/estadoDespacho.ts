import type { Despacho, EstadoDespacho } from '../dominio/tipos'

export function etiquetaDespacho(estado: EstadoDespacho): 'Planificado' | 'En ruta' | 'Finalizado' | 'Cancelado' {
  if (estado === 'planificado') return 'Planificado'
  if (estado === 'en_ruta') return 'En ruta'
  if (estado === 'finalizado') return 'Finalizado'
  return 'Cancelado'
}

export function claseDespacho(estado: EstadoDespacho): string {
  if (estado === 'planificado') return 'pastilla pastilla-info'
  if (estado === 'en_ruta') return 'pastilla pastilla-alerta'
  if (estado === 'finalizado') return 'pastilla pastilla-ok'
  return 'pastilla pastilla-error'
}

export function avanceEntregas(despacho: Despacho): string {
  const hechas = despacho.paradas.filter((parada) => parada.entregada_at).length
  return `${hechas} de ${despacho.paradas.length}`
}
