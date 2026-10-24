import type { ReactNode } from 'react'

/** Fila de título del mockup: el h1 a la izquierda y las acciones de la pantalla a la derecha. */
export function Encabezado({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return (
    <header className="pagina-encabezado">
      <h1>{titulo}</h1>
      {children && <div className="pagina-acciones">{children}</div>}
    </header>
  )
}
