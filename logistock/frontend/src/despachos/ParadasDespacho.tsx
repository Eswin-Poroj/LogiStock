import type { Despacho } from '../dominio/tipos'
import { horaDe } from './formatoRuta'

/** Lista de paradas en orden; `accion` dibuja el botón de cada parada pendiente. */
export function ParadasDespacho({ despacho, accion }: { despacho: Despacho; accion?: (paradaId: string, orden: number) => JSX.Element }) {
  return (
    <ol className="orden-entrega">
      {despacho.paradas.map((parada) => (
        <li className="parada" key={parada.id}>
          <span className="orden">{parada.orden}</span>
          <span>
            <strong>{parada.cliente || `Parada ${parada.orden}`}</strong>
            <small>{[parada.numero_pedido, parada.direccion].filter(Boolean).join(' · ')}</small>
          </span>
          <span className="hora">
            {parada.entregada_at
              ? <span className="pastilla pastilla-ok">Entregada {horaDe(parada.entregada_at)}</span>
              : accion ? accion(parada.id, parada.orden) : parada.eta ? horaDe(parada.eta) : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}
