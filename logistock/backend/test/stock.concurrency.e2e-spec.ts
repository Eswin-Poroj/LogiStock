import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, ponerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('Reserva de stock concurrente (R1)', () => {
  let app: INestApplication;
  let admin: SupabaseClient;
  let semilla: Semilla;
  let productoId: string;

  beforeAll(async () => {
    assertEntornoLocal();
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    semilla = await sembrar(admin);
    productoId = await crearProducto(admin, `PA10-${Date.now()}`, 10, semilla.bodegaId, 100);
    app = await crearApp();
  });
  afterAll(() => app.close());

  beforeEach(() => ponerStock(admin, productoId, semilla.bodegaId, 100, 0));

  it('PA-10 nunca reserva más unidades de las disponibles', async () => {
    const crear = () =>
      request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 30 }],
        });

    const respuestas = await Promise.all(Array.from({ length: 5 }, crear));
    const creados = respuestas.filter((r) => r.status === 201).length;
    const rechazados = respuestas.filter((r) => [409, 423].includes(r.status)).length;
    if (creados !== 3 || rechazados !== 2) {
      console.log('PA-10 status', respuestas.map((r) => r.status));
    }
    expect(creados).toBe(3);
    expect(rechazados).toBe(2);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 10, reservado: 90 });
  });
});
