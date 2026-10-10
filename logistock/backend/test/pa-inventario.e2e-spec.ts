import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA inventario', () => {
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

  it('PA-15 entrada de mercancía', async () => {
    const productoId = await crearProducto(admin, `PA15-${Date.now()}`, 10, semilla.bodegaId, 10);
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventario/entradas')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({
        proveedor_id: semilla.proveedorId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 200 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.codigo).toEqual(expect.any(String));
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 210 });
    const mov = await admin.from('movimientos_stock').select('tipo, cantidad, referencia')
      .eq('producto_id', productoId).eq('referencia', res.body.codigo);
    expect(mov.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ tipo: 'entrada', cantidad: 200, referencia: res.body.codigo }),
    ]));
  });
});
