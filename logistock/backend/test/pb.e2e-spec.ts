import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { assertEntornoLocal } from './helpers/local';
import { sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

async function conPg<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertEntornoLocal();
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

describe('PB base de datos', () => {
  let admin: SupabaseClient;
  let semilla: Semilla;

  beforeAll(async () => {
    assertEntornoLocal();
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    semilla = await sembrar(admin);
  });

  it('aborta si el host no es local', () => {
    const previaU = process.env.SUPABASE_URL;
    const previaD = process.env.DATABASE_URL;
    process.env.SUPABASE_URL = 'https://lrjoozqkydvzptuzskjz.supabase.co';
    try {
      expect(() => assertEntornoLocal()).toThrow('ABORTADO: la base no es local');
    } finally {
      process.env.SUPABASE_URL = previaU;
      process.env.DATABASE_URL = previaD;
    }
  });

  it('PB-01 reserva simultánea sin sobreventa', async () => {
    // Criterio: 3 devuelven true, 2 devuelven false. Quedan 10 disponibles y 90 reservados.
    const sku = `PB01-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    const stock = await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 100, reservado: 0 }).select('id').single();
    if (stock.error) throw stock.error;
    const resultados = await Promise.all(Array.from({ length: 5 }, () => conPg(async (c) => {
      const r = await c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 30, 'PB-01', null]);
      return r.rows[0].ok as boolean;
    })));
    const trues = resultados.filter(Boolean).length;
    expect(trues).toBe(3);
    expect(resultados.filter((ok) => !ok).length).toBe(2);
    const queda = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId).single();
    expect(Number(queda.data!.disponible)).toBe(10);
    expect(Number(queda.data!.reservado)).toBe(90);
  });

  it('PB-02 reserva mayor al disponible', async () => {
    // Criterio: Devuelve false y el stock no cambia.
    const sku = `PB02-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 312, reservado: 0 });
    const primera = await conPg((c) => c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 40, 'PB-02', null]));
    expect(primera.rows[0].ok).toBe(true);
    const antes = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).single();
    expect(Number(antes.data!.disponible)).toBe(272);
    expect(Number(antes.data!.reservado)).toBe(40);
    const segunda = await conPg((c) => c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 300, 'PB-02', null]));
    expect(segunda.rows[0].ok).toBe(false);
    const despues = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).single();
    expect(Number(despues.data!.disponible)).toBe(272);
    expect(Number(despues.data!.reservado)).toBe(40);
  });

  it('PB-03 stock negativo bloqueado', async () => {
    // Criterio: Error por la restricción CHECK; no se guarda.
    const sku = `PB03-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 5, reservado: 0 });
    await expect(conPg((c) => c.query('update stock set disponible = -1 where producto_id = $1', [productoId]))).rejects.toThrow(/check|disponible/i);
    const queda = await admin.from('stock').select('disponible').eq('producto_id', productoId).single();
    expect(Number(queda.data!.disponible)).toBe(5);
  });

  it('PB-04 transición de estado inválida', async () => {
    // Criterio: Excepción "Transición de pedido no permitida".
    const pedido = await admin.from('pedidos').insert({
      cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
    }).select('id, estado').single();
    if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
    expect(pedido.data.estado).toBe('creado');
    const paso = await admin.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedido.data.id).eq('estado', 'creado');
    if (paso.error) throw paso.error;
    const { error } = await admin.from('pedidos').update({ estado: 'creado' }).eq('id', pedido.data.id);
    expect(error).toBeTruthy();
    expect(error!.message).toContain('Transición de pedido no permitida');
    const queda = await admin.from('pedidos').select('estado').eq('id', pedido.data.id).single();
    expect(queda.data!.estado).toBe('en_preparacion');
  });

  it('PB-05 número de pedido secuencial', async () => {
    // Criterio: Se genera PED-000001 y los siguientes consecutivos.
    await conPg(async (c) => {
      await c.query("select setval('pedido_numero_seq', 1, false)");
      const a = await c.query(
        'insert into pedidos (cliente_id, bodega_id, creado_por) values ($1,$2,$3) returning numero',
        [semilla.clienteId, semilla.bodegaId, semilla.asesor.id],
      );
      const b = await c.query(
        'insert into pedidos (cliente_id, bodega_id, creado_por) values ($1,$2,$3) returning numero',
        [semilla.clienteId, semilla.bodegaId, semilla.asesor.id],
      );
      expect(a.rows[0].numero).toBe('PED-000001');
      expect(b.rows[0].numero).toBe('PED-000002');
      console.log('PB-05 evidencia: la secuencia local pedido_numero_seq quedó adelantada');
    });
  });

  it('PB-06 entrada suma al disponible', async () => {
    // Criterio: Se crea la fila de stock con 312 disponibles y un movimiento de entrada.
    const sku = `PB06-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    const previo = await admin.from('stock').select('id').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId);
    expect(previo.data ?? []).toHaveLength(0);
    await conPg((c) => c.query('select registrar_entrada($1,$2,$3,$4,$5)', [productoId, semilla.bodegaId, 312, 'PB-06', null]));
    const queda = await admin.from('stock').select('disponible').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId).single();
    expect(Number(queda.data!.disponible)).toBe(312);
    const mov = await admin.from('movimientos_stock').select('tipo, cantidad').eq('producto_id', productoId).eq('referencia', 'PB-06');
    expect(mov.data).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'entrada', cantidad: 312 })]));
  });
});
