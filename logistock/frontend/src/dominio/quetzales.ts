export function quetzales(valor: number): string {
  const negativo = valor < 0
  const [entero, decimal] = Math.abs(valor).toFixed(2).split('.')
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negativo ? '-' : ''}Q ${conMiles}.${decimal}`
}
