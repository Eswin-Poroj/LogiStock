import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, sembrar, Semilla } from './helpers/semilla';

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
});
