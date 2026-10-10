import { BadRequestException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

describe('PedidosService compensación', () => {
  it('PA-09 libera la reserva si falla el guardado de las líneas', async () => {
    const eliminado = jest.fn().mockResolvedValue({});
    const liberados: { p_cantidad: number }[] = [];
    const tabla: any = {
      productos: { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'p1', sku: 'FER-0012', nombre: 'Cemento', precio_unitario: 10 }] }) }) }) },
      pedidos: {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x', numero: 'PED-000009' }, error: null }) }) }),
        delete: () => ({ eq: eliminado }),
      },
      pedido_lineas: { insert: async () => ({ error: { message: 'fallo' } }) },
    };
    const rpc = jest.fn(async (fn: string, args: { p_cantidad: number }) => {
      if (fn === 'reservar_stock') return { data: true, error: null };
      if (fn === 'liberar_stock') liberados.push(args);
      return { data: null, error: null };
    });
    const db: any = { from: (t: string) => tabla[t], rpc };
    const locks: any = { conLocks: (_k: string[], fn: () => Promise<unknown>) => fn() };
    const config: any = { get: () => 12 };
    const cola: any = { add: jest.fn() };
    const servicio = new PedidosService({ db } as any, locks, config, cola);

    await expect(servicio.crear(
      { cliente_id: 'c', bodega_id: 'b', lineas: [{ producto_id: 'p1', cantidad: 10 }] } as any,
      { id: 'u', nombre: 'A', rol: 'asesor_ventas', bodega_id: null },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(liberados[0].p_cantidad).toBe(10);
    expect(eliminado).toHaveBeenCalled();
  });
});
