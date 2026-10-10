import { ConflictException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

/** Prueba unitaria: si ninguna línea tiene stock, el pedido se rechaza con 409 y se elimina. */
describe('PedidosService.crear', () => {
  it('PA-02 responde 409 con lineas_sin_stock y no deja el pedido', async () => {
    const eliminado = jest.fn().mockResolvedValue({});
    const tabla: any = {
      productos: { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'p1', sku: 'FER-0012', nombre: 'Cemento', precio_unitario: 78 }] }) }) }) },
      pedidos: {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x', numero: 'PED-000001' } }) }) }),
        delete: () => ({ eq: eliminado }),
      },
      stock: { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { disponible: 18 } }) }) }) }) },
    };
    const db: any = { from: (t: string) => tabla[t], rpc: async () => ({ data: false, error: null }) };
    const locks: any = { conLocks: (_k: string[], fn: () => Promise<unknown>) => fn() };
    const config: any = { get: () => 12 };
    const cola: any = { add: jest.fn() };
    const servicio = new PedidosService({ db } as any, locks, config, cola);
    const dto = { cliente_id: 'c', bodega_id: 'b', politica_faltantes: 'rechazar', lineas: [{ producto_id: 'p1', cantidad: 60 }] } as any;
    const usuario = { id: 'u', nombre: 'A', rol: 'asesor_ventas', bodega_id: null } as const;

    await expect(servicio.crear(dto, usuario)).rejects.toBeInstanceOf(ConflictException);
    await expect(servicio.crear(dto, usuario)).rejects.toMatchObject({
      response: {
        statusCode: 409,
        lineas_sin_stock: [{ producto_id: 'p1', sku: 'FER-0012', solicitado: 60, disponible: 18 }],
      },
    });
    expect(eliminado).toHaveBeenCalled();
    expect(cola.add).not.toHaveBeenCalled();
  });
});
