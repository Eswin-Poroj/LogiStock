import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import Redlock from 'redlock';
import request from 'supertest';
import { LockService } from '../src/common/redis/lock.service';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA pedidos', () => {
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

  it('PA-01 pedido con stock suficiente', async () => {
    const a = await crearProducto(admin, `PA01A-${Date.now()}`, 78, semilla.bodegaId, 100);
    const b = await crearProducto(admin, `PA01B-${Date.now()}`, 20, semilla.bodegaId, 100);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: a, cantidad: 40 }, { producto_id: b, cantidad: 25 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('creado');
    expect(res.body.lineas).toHaveLength(2);
    expect(res.body.lineas.every((l: { estado: string }) => l.estado === 'reservada')).toBe(true);
    expect(Number(res.body.subtotal)).toBe(3620);
    expect(Number(res.body.iva)).toBe(434.4);
    expect(Number(res.body.total)).toBe(4054.4);
  });

  it('PA-02 rechaza la línea sin stock', async () => {
    const productoId = await crearProducto(admin, `PA02-${Date.now()}`, 10, semilla.bodegaId, 18);
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'rechazar',
        lineas: [{ producto_id: productoId, cantidad: 60 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.lineas_sin_stock[0]).toMatchObject({ solicitado: 60, disponible: 18 });
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 18, reservado: 0 });
    const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    expect(despues.count).toBe(antes.count);
  });

  it('PA-03 backorder parcial', async () => {
    const a = await crearProducto(admin, `PA03A-${Date.now()}`, 40, semilla.bodegaId, 100);
    const b = await crearProducto(admin, `PA03B-${Date.now()}`, 25, semilla.bodegaId, 100);
    const c = await crearProducto(admin, `PA03C-${Date.now()}`, 99, semilla.bodegaId, 0);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'backorder',
        lineas: [
          { producto_id: a, cantidad: 10 },
          { producto_id: b, cantidad: 10 },
          { producto_id: c, cantidad: 1 },
        ],
      });
    expect(res.status).toBe(201);
    const lineaC = res.body.lineas.find((l: { producto_id: string }) => l.producto_id === c);
    expect(lineaC.estado).toBe('backorder');
    expect(Number(res.body.subtotal)).toBe(650);
    expect(Number(res.body.iva)).toBe(78);
    expect(Number(res.body.total)).toBe(728);
    expect(await leerStock(admin, c, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
  });

  it('PA-04 ninguna línea con stock', async () => {
    const a = await crearProducto(admin, `PA04A-${Date.now()}`, 10, semilla.bodegaId, 0);
    const b = await crearProducto(admin, `PA04B-${Date.now()}`, 10, semilla.bodegaId, 0);
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'backorder',
        lineas: [{ producto_id: a, cantidad: 1 }, { producto_id: b, cantidad: 1 }],
      });
    expect(res.status).toBe(409);
    const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    expect(despues.count).toBe(antes.count);
    expect(await leerStock(admin, a, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
    expect(await leerStock(admin, b, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
  });

  it('PA-05 cantidad inválida', async () => {
    const productoId = await crearProducto(admin, `PA05-${Date.now()}`, 10, semilla.bodegaId, 10);
    for (const cantidad of [0, -1]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad }],
        });
      expect(res.status).toBe(400);
    }
  });

  it('PA-06 producto inexistente o inactivo', async () => {
    const ausente = '11111111-1111-4111-8111-111111111111';
    const inactivo = await crearProducto(admin, `PA06-${Date.now()}`, 10, semilla.bodegaId, 10);
    await admin.from('productos').update({ activo: false }).eq('id', inactivo);
    for (const productoId of [ausente, inactivo]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 1 }],
        });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(productoId);
    }
  });

  it('PA-07 lock ocupado', async () => {
    const productoId = await crearProducto(admin, `PA07-${Date.now()}`, 10, semilla.bodegaId, 100);
    const redis = new Redis(process.env.REDIS_URL!);
    const redlock = new Redlock([redis], { retryCount: 0 });
    const lock = await redlock.acquire([LockService.llaveStock(productoId, semilla.bodegaId)], 3000);
    try {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 10 }] });
      expect(res.status).toBe(423);
      expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 100, reservado: 0 });
    } finally {
      await lock.release();
      await redis.quit();
    }
  });

  it('PA-09 compensación ante fallo al guardar líneas', async () => {
    const { Client } = await import('pg');
    const productoId = await crearProducto(admin, `PA09-${Date.now()}`, 10, semilla.bodegaId, 40);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    try {
      await pg.query(`create or replace function public._prueba_fallar_lineas() returns trigger
        language plpgsql as $$ begin raise exception 'fallo forzado de prueba'; end $$`);
      await pg.query(`create trigger trg_prueba_fallar_lineas before insert on pedido_lineas
        for each row execute function public._prueba_fallar_lineas()`);
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 10 }],
        });
      expect(res.status).not.toBe(201);
      expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 40, reservado: 0 });
      const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
      expect(despues.count).toBe(antes.count);
    } finally {
      await pg.query('drop trigger if exists trg_prueba_fallar_lineas on pedido_lineas');
      await pg.query('drop function if exists public._prueba_fallar_lineas()');
      await pg.end();
    }
  });
});
