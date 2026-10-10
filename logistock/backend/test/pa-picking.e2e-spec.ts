import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job } from 'bullmq';
import { Client } from 'pg';
import { PickingProcessor } from '../src/modules/picking/picking.processor';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, ponerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA picking', () => {
  let app: INestApplication;
  let admin: SupabaseClient;
  let semilla: Semilla;

  beforeAll(async () => {
    assertEntornoLocal();
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    semilla = await sembrar(admin);
    app = await crearApp();
  });
  afterAll(async () => { await app.close(); });

  it('PA-14 procesar dos veces el mismo trabajo', async () => {
    const productoId = await crearProducto(admin, `PA14-${Date.now()}`, 10, semilla.bodegaId, 100);
    await ponerStock(admin, productoId, semilla.bodegaId, 60, 40);
    const pedido = await admin.from('pedidos').insert({
      cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
    }).select('id').single();
    if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
    const linea = await admin.from('pedido_lineas').insert({
      pedido_id: pedido.data.id, producto_id: productoId, cantidad: 40, precio_unitario: 10, estado: 'reservada',
    });
    if (linea.error) throw linea.error;
    const processor = app.get(PickingProcessor);
    await processor.process({ data: { pedido_id: pedido.data.id } } as Job<{ pedido_id: string }>);
    await processor.process({ data: { pedido_id: pedido.data.id } } as Job<{ pedido_id: string }>);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    try {
      const tareas = await pg.query('select count(*)::int as n from tareas_picking where pedido_id = $1', [pedido.data.id]);
      const lineas = await pg.query(`select count(*)::int as n from picking_lineas pl
        join tareas_picking t on t.id = pl.tarea_id where t.pedido_id = $1`, [pedido.data.id]);
      expect(tareas.rows[0].n).toBe(1);
      expect(lineas.rows[0].n).toBe(1);
    } finally {
      await pg.end();
    }
  });
});
