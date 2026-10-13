export function textoDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = Math.round(minutos % 60)
  if (horas <= 0) return `${resto} min`
  return `${horas} h ${resto} min`
}
