import { alertasStock, masVendidos, periodoDe, resumen } from './reportes.calculos';

const linea = (sku: string, cantidad: number, estado = 'reservada') => ({ sku, nombre: sku, cantidad, estado });

describe('reportes.calculos', () => {
  it('sin fechas toma los últimos 7 días contando hoy', () => {
    expect(periodoDe(undefined, undefined, new Date('2026-10-24T15:00:00Z'))).toEqual({ desde: '2026-10-18', hasta: '2026-10-24' });
  });

  it('resumen cuenta paradas por día, entregas a tiempo, rotación y backorder', () => {
    const periodo = { desde: '2026-10-20', hasta: '2026-10-22' };
    const despachos = [
      { created_at: '2026-10-20T10:00:00Z', paradas: [
        { eta: '2026-10-20T12:00:00Z', entregada_at: '2026-10-20T11:00:00Z' },
        { eta: '2026-10-20T12:00:00Z', entregada_at: '2026-10-20T13:00:00Z' },
      ] },
      { created_at: '2026-10-22T09:00:00Z', paradas: [{ eta: null, entregada_at: null }] },
    ];
    const pedidos = [
      { estado: 'entregado', lineas: [linea('A', 6)] },
      { estado: 'creado', lineas: [linea('B', 4, 'backorder')] },
      { estado: 'cancelado', lineas: [linea('C', 9, 'backorder')] },
    ];
    const stock = [{ sku: 'A', nombre: 'A', disponible: 4, stock_minimo: 0 }];

    expect(resumen(periodo, despachos, pedidos, stock)).toEqual({
      pedidos_despachados: 3,
      entregas_a_tiempo_pct: 50,
      rotacion_inventario: 1.5,
      pedidos_con_backorder: 1,
      despachos_por_dia: [
        { fecha: '2026-10-20', cantidad: 2 },
        { fecha: '2026-10-21', cantidad: 0 },
        { fecha: '2026-10-22', cantidad: 1 },
      ],
    });
  });

  it('sin entregas ni existencias devuelve 0 en vez de dividir entre cero', () => {
    const r = resumen({ desde: '2026-10-20', hasta: '2026-10-20' }, [], [], []);
    expect(r.entregas_a_tiempo_pct).toBe(0);
    expect(r.rotacion_inventario).toBe(0);
  });

  it('más vendidos suma unidades por SKU, ignora cancelados y respeta el límite', () => {
    const pedidos = [
      { estado: 'creado', lineas: [linea('A', 2), linea('B', 5)] },
      { estado: 'entregado', lineas: [linea('A', 4)] },
      { estado: 'cancelado', lineas: [linea('C', 50)] },
    ];
    expect(masVendidos(pedidos, 1)).toEqual([{ sku: 'A', nombre: 'A', unidades: 6 }]);
  });

  it('alertas suma bodegas y marca agotado o stock bajo según el mínimo', () => {
    const stock = [
      { sku: 'A', nombre: 'A', disponible: 0, stock_minimo: 5 },
      { sku: 'B', nombre: 'B', disponible: 3, stock_minimo: 5 },
      { sku: 'B', nombre: 'B', disponible: 1, stock_minimo: 5 },
      { sku: 'C', nombre: 'C', disponible: 9, stock_minimo: 5 },
    ];
    expect(alertasStock(stock)).toEqual([
      { sku: 'A', nombre: 'A', disponible: 0, estado: 'agotado' },
      { sku: 'B', nombre: 'B', disponible: 4, estado: 'stock_bajo' },
    ]);
  });
});
