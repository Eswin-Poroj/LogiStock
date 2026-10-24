function celda(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

export function csvConBom(filas: string[][]): string {
  const lineas = filas.map((fila) => fila.map(celda).join(','))
  return `\uFEFF${lineas.join('\n')}`
}
