export function textoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = Math.round(minutos % 60)
  if (horas <= 0) return `${resto} min`
  return `${horas} h ${resto} min`
}

/** Hora local HH:mm de una ETA ISO; si no es una fecha, la deja como viene. */
export function horaDe(eta: string): string {
  if (!eta.includes('T')) return eta
  const fecha = new Date(eta)
  if (Number.isNaN(fecha.getTime())) return eta
  return fecha.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', hour12: false })
}
