import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job } from 'bullmq';
import { Client } from 'pg';
import request from 'supertest';
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

  describe('escaneo y cierre', () => {
    let tareaId: string;
    let pedidoId: string;
    let skuLinea: string;
    const skuAjeno = `AJENO-${Date.now()}`;

    beforeAll(async () => {
      skuLinea = `PA18-${Date.now()}`;
      const productoId = await crearProducto(admin, skuLinea, 10, semilla.bodegaId, 100);
      const pedido = await admin.from('pedidos').insert({
        cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
      }).select('id').single();
      if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
      pedidoId = pedido.data.id;
      await admin.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'creado');
      const linea = await admin.from('pedido_lineas').insert({
        pedido_id: pedidoId, producto_id: productoId, cantidad: 40, precio_unitario: 10, estado: 'reservada',
      });
      if (linea.error) throw linea.error;
      await app.get(PickingProcessor).process({ data: { pedido_id: pedidoId } } as Job<{ pedido_id: string }>);
      const tarea = await admin.from('tareas_picking').select('id').eq('pedido_id', pedidoId).single();
      if (tarea.error || !tarea.data) throw tarea.error ?? new Error('sin tarea');
      tareaId = tarea.data.id;
    });

    it('PA-18 escaneo de SKU ajeno', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/escaneos`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ sku: skuAjeno });
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain(skuAjeno);
      const linea = await admin.from('picking_lineas').select('cantidad_recogida').eq('tarea_id', tareaId).single();
      expect(linea.data!.cantidad_recogida).toBe(0);
    });

    it('PA-19 escaneo que excede la cantidad', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/escaneos`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ sku: skuLinea, cantidad: 41 });
      expect(res.status).toBe(409);
      const linea = await admin.from('picking_lineas').select('cantidad_recogida').eq('tarea_id', tareaId).single();
      expect(linea.data!.cantidad_recogida).toBe(0);
    });

    it('GET /picking/tareas incluye la tarea con número de pedido y cliente', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/picking/tareas')
        .set('Authorization', `Bearer ${semilla.operario.token}`);
      expect(res.status).toBe(200);
      const tarea = res.body.find((t: { id: string }) => t.id === tareaId);
      expect(tarea).toMatchObject({ pedido_id: pedidoId, numero_pedido: expect.stringMatching(/^PED-/), cliente: expect.any(String) });
      expect(tarea.lineas[0]).toMatchObject({ sku: skuLinea, cantidad: 40, cantidad_recogida: 0 });
    });

    it('PA-20 cerrar picking incompleto', async () => {
      const vacio = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/completar`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({});
      expect(vacio.status).toBe(409);
      const medio = await admin.from('tareas_picking').select('estado').eq('id', tareaId).single();
      expect(medio.data!.estado).not.toBe('completado');
      const conFaltante = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/completar`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ faltante: true, nota: 'no se persiste' });
      expect(conFaltante.status).toBe(200);
      expect(conFaltante.body.estado).toBe('con_faltante');
      const pedido = await admin.from('pedidos').select('estado').eq('id', pedidoId).single();
      expect(pedido.data!.estado).toBe('en_preparacion');
    });
  });
});
