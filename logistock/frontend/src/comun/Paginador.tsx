export function Paginador({ pagina, paginas, total, onPagina, etiqueta = 'registros' }: {
  pagina: number
  paginas: number
  total: number
  onPagina: (pagina: number) => void
  etiqueta?: string
}) {
  if (total === 0) return null
  return (
    <nav className="paginador" aria-label="Paginación">
      <span>{total} {etiqueta} · página {pagina} de {paginas}</span>
      <div>
        <button type="button" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>Anterior</button>
        <button type="button" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)}>Siguiente</button>
      </div>
    </nav>
  )
}

export function BuscadorTabla({ valor, onCambio, placeholder }: { valor: string; onCambio: (valor: string) => void; placeholder: string }) {
  return (
    <label className="buscador-tabla">
      <span className="solo-lectores">Buscar</span>
      <input type="search" aria-label="Buscar en la tabla" placeholder={placeholder} value={valor} onChange={(e) => onCambio(e.target.value)} />
    </label>
  )
}
