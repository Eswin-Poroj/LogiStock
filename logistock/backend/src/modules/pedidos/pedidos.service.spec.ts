import { ConflictException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

/** Prueba unitaria: si ninguna línea tiene stock, el pedido se rechaza con 409 y se elimina. */
describe('PedidosService.crear', () => {
  it('responde 409 y no deja el pedido cuando no hay stock', async () => {
    const eliminado = jest.fn().mockResolvedValue({});
    const tabla: any = {
      productos: { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'p1', sku: 'FER-0012', nombre: 'Cemento', precio_unitario: 78 }] }) }) }) },
      pedidos: {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x', numero: 'PED-000001' } }) }) }),
        delete: () => ({ eq: eliminado }),
      },
      stock: { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { disponible: 10 } }) }) }) }) },
    };
    const db: any = { from: (t: string) => tabla[t], rpc: async () => ({ data: false, error: null }) };
    const locks: any = { conLocks: (_k: string[], fn: () => Promise<unknown>) => fn() };
    const config: any = { get: () => 12 };
    const cola: any = { add: jest.fn() };
    const servicio = new PedidosService({ db } as any, locks, config, cola);

    await expect(
      servicio.crear(
        { cliente_id: 'c', bodega_id: 'b', lineas: [{ producto_id: 'p1', cantidad: 60 }] } as any,
        { id: 'u', nombre: 'A', rol: 'asesor_ventas', bodega_id: null },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(eliminado).toHaveBeenCalled();
    expect(cola.add).not.toHaveBeenCalled();
  });
});
