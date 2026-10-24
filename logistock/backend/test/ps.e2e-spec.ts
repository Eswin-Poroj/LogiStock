import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { Semilla, crearProducto, pickingCompletado, sembrar } from './helpers/semilla';

jest.setTimeout(120000);

describe('PS seguridad', () => {
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
  afterAll(async () => {
    await app.close();
  });

  it('PS-01 sin token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/pedidos');
    expect(res.status).toBe(401);
  });

  it('PS-02 token alterado', async () => {
    const [h, p, s] = semilla.asesor.token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.sub = '00000000-0000-0000-0000-000000000000';
    const nuevo = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${h}.${nuevo}.${s}`);
    expect(res.status).toBe(401);
  });

  it('PS-03 operario sin permiso en pedidos', async () => {
    const productoId = await crearProducto(admin, `PS03-${Date.now()}`, 10, semilla.bodegaId, 10);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it('PS-04 asesor consulta reportes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/reportes/resumen')
      .set('Authorization', `Bearer ${semilla.asesor.token}`);
    console.log('PS-04 body', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(403);
  });

  it('PS-05 RLS con el JWT del asesor', async () => {
    const productoId = await crearProducto(admin, `PS05-${Date.now()}`, 10, semilla.bodegaId, 10);
    const ins = await admin.from('movimientos_stock').insert({
      producto_id: productoId,
      bodega_id: semilla.bodegaId,
      tipo: 'entrada',
      cantidad: 1,
      referencia: 'PS-05',
    });
    if (ins.error) throw ins.error;
    const usuario = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await usuario.auth.setSession({ access_token: semilla.asesor.token, refresh_token: semilla.asesor.refresh });
    const visto = await usuario.from('movimientos_stock').select('id');
    expect(visto.error).toBeNull();
    expect(visto.data).toEqual([]);
    const operario = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await operario.auth.setSession({ access_token: semilla.operario.token, refresh_token: semilla.operario.refresh });
    const vistoOp = await operario.from('movimientos_stock').select('id');
    expect(vistoOp.error).toBeNull();
    expect((vistoOp.data ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('PS-06 administrador', async () => {
    const productoId = await crearProducto(admin, `PS06-${Date.now()}`, 10, semilla.bodegaId, 100);
    const pedido = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 1 }],
      });
    const entrada = await request(app.getHttpServer())
      .post('/api/v1/inventario/entradas')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({
        proveedor_id: semilla.proveedorId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 1 }],
      });
    const otro = await crearProducto(admin, `PS06B-${Date.now()}`, 10, semilla.bodegaId, 10);
    const ped2 = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: otro, cantidad: 1 }],
      });
    await pickingCompletado(admin, ped2.body.id);
    const despacho = await request(app.getHttpServer())
      .post('/api/v1/despachos')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({
        vehiculo_id: semilla.vehiculoId,
        conductor_id: semilla.conductorId,
        bodega_id: semilla.bodegaId,
        paradas: [{ pedido_id: ped2.body.id, orden: 1 }],
      });
    const reporte = await request(app.getHttpServer())
      .get('/api/v1/reportes/resumen')
      .set('Authorization', `Bearer ${semilla.admin.token}`);
    const status = { pedido: pedido.status, entrada: entrada.status, despacho: despacho.status, reporte: reporte.status };
    console.log('PS-06', JSON.stringify(status));
    expect(pedido.status).toBe(201);
    expect(entrada.status).toBe(201);
    expect(despacho.status).toBe(201);
    expect(reporte.status).toBe(200);
  });
});
