/** CU-06 A2: carga del viaje frente a la capacidad del vehículo. Funciones puras. */

export interface CargaPedido { pedido_id: string; numero: string; kg: number }

export interface Viaje { pedidos: string[]; kg: number }

export function redondearKg(kg: number) {
  return Math.round(kg * 1000) / 1000;
}

/**
 * Sugiere repartir los pedidos en viajes que quepan en el vehículo: primero los más pesados,
 * cada uno en el primer viaje donde entra (first-fit decreasing). Un pedido que por sí solo
 * supera la capacidad queda en su propio viaje y se marca en `no_caben`.
 */
export function sugerirViajes(cargas: CargaPedido[], capacidadKg: number): { viajes: Viaje[]; no_caben: string[] } {
  const viajes: Viaje[] = [];
  const noCaben: string[] = [];
  for (const carga of [...cargas].sort((a, b) => b.kg - a.kg || a.numero.localeCompare(b.numero))) {
    if (carga.kg > capacidadKg) {
      noCaben.push(carga.numero);
      viajes.push({ pedidos: [carga.numero], kg: redondearKg(carga.kg) });
      continue;
    }
    const destino = viajes.find((v) => !v.pedidos.some((n) => noCaben.includes(n)) && v.kg + carga.kg <= capacidadKg);
    if (destino) {
      destino.pedidos.push(carga.numero);
      destino.kg = redondearKg(destino.kg + carga.kg);
    } else {
      viajes.push({ pedidos: [carga.numero], kg: redondearKg(carga.kg) });
    }
  }
  return { viajes, no_caben: noCaben };
}
