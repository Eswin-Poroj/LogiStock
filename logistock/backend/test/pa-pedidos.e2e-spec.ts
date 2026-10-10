import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
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
});
