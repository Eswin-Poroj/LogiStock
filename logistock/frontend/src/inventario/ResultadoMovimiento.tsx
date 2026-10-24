import type { Existencia, Movimiento } from '../dominio/tipos'

export function ResultadoMovimiento({ movimiento, existencia }: { movimiento: Movimiento; existencia: Existencia | null }) {
  return (
    <div className="tarjeta-info" role="status">
      <p className="nota-ok">Stock actualizado</p>
      <p>Movimiento {movimiento.tipo} · Cantidad {movimiento.cantidad > 0 ? `+${movimiento.cantidad}` : movimiento.cantidad}</p>
      {existencia && <p>Disponible: {existencia.disponible} · Reservado: {existencia.reservado} · Dañado: {existencia.danado}</p>}
    </div>
  )
}
