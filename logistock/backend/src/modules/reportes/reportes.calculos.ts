/** Cálculos puros de los reportes: reciben filas ya leídas de la base y no tocan la red. */

export interface Periodo { desde: string; hasta: string }

export interface DespachoFila {
  created_at: string;
  paradas: { eta: string | null; entregada_at: string | null }[];
}

export interface PedidoFila {
  estado: string;
  lineas: { cantidad: number; estado: string; sku: string; nombre: string }[];
}

export interface StockFila { sku: string; nombre: string; disponible: number; stock_minimo: number }

const DIA_MS = 24 * 60 * 60 * 1000;
const VENDIDO = new Set(['despachado', 'entregado']);

function fechaIso(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

/** Sin fechas, el periodo son los últimos 7 días contando hoy. */
export function periodoDe(desde?: string, hasta?: string, hoy = new Date()): Periodo {
  const fin = hasta ?? fechaIso(hoy);
  const inicio = desde ?? fechaIso(new Date(Date.parse(fin) - 6 * DIA_MS));
  return { desde: inicio, hasta: fin };
}

/** Límite superior exclusivo para filtrar timestamps: el día siguiente a `hasta`. */
export function finExclusivo(periodo: Periodo) {
  return fechaIso(new Date(Date.parse(periodo.hasta) + DIA_MS));
}

function diasDe(periodo: Periodo) {
  const dias: string[] = [];
  for (let t = Date.parse(periodo.desde); t <= Date.parse(periodo.hasta); t += DIA_MS) dias.push(fechaIso(new Date(t)));
  return dias;
}

export function resumen(periodo: Periodo, despachos: DespachoFila[], pedidos: PedidoFila[], stock: StockFila[]) {
  const porDia = new Map(diasDe(periodo).map((dia) => [dia, 0]));
  let despachados = 0;
  let entregadas = 0;
  let aTiempo = 0;
  for (const despacho of despachos) {
    const dia = despacho.created_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + despacho.paradas.length);
    despachados += despacho.paradas.length;
    for (const parada of despacho.paradas) {
      if (!parada.entregada_at) continue;
      entregadas += 1;
      if (!parada.eta || Date.parse(parada.entregada_at) <= Date.parse(parada.eta)) aTiempo += 1;
    }
  }
  const vendidas = pedidos
    .filter((p) => VENDIDO.has(p.estado))
    .reduce((suma, p) => suma + p.lineas.reduce((s, l) => s + l.cantidad, 0), 0);
  const existencias = stock.reduce((suma, fila) => suma + fila.disponible, 0);
  return {
    pedidos_despachados: despachados,
    entregas_a_tiempo_pct: entregadas ? Math.round((aTiempo / entregadas) * 1000) / 10 : 0,
    rotacion_inventario: existencias ? Math.round((vendidas / existencias) * 100) / 100 : 0,
    pedidos_con_backorder: pedidos.filter((p) => p.estado !== 'cancelado' && p.lineas.some((l) => l.estado === 'backorder')).length,
    despachos_por_dia: [...porDia].map(([fecha, cantidad]) => ({ fecha, cantidad })),
  };
}

export function masVendidos(pedidos: PedidoFila[], limite: number) {
  const porSku = new Map<string, { sku: string; nombre: string; unidades: number }>();
  for (const pedido of pedidos) {
    if (pedido.estado === 'cancelado') continue;
    for (const linea of pedido.lineas) {
      const fila = porSku.get(linea.sku) ?? { sku: linea.sku, nombre: linea.nombre, unidades: 0 };
      fila.unidades += linea.cantidad;
      porSku.set(linea.sku, fila);
    }
  }
  return [...porSku.values()].sort((a, b) => b.unidades - a.unidades || a.sku.localeCompare(b.sku)).slice(0, limite);
}

/** Suma el disponible del producto en las bodegas pedidas y lo compara con su stock mínimo. */
export function alertasStock(stock: StockFila[]) {
  const porSku = new Map<string, StockFila>();
  for (const fila of stock) {
    const previa = porSku.get(fila.sku);
    porSku.set(fila.sku, previa ? { ...previa, disponible: previa.disponible + fila.disponible } : { ...fila });
  }
  return [...porSku.values()]
    .filter((fila) => fila.disponible === 0 || fila.disponible <= fila.stock_minimo)
    .map((fila) => ({
      sku: fila.sku,
      nombre: fila.nombre,
      disponible: fila.disponible,
      estado: fila.disponible === 0 ? ('agotado' as const) : ('stock_bajo' as const),
    }))
    .sort((a, b) => a.disponible - b.disponible || a.sku.localeCompare(b.sku));
}
