import { execSync } from 'child_process';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(20000);

const backendDir = resolve(__dirname, '..');

describe('PA-08 Redis no disponible', () => {
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
    productoId = await crearProducto(admin, `PA08-${Date.now()}`, 10, semilla.bodegaId, 50);
    app = await crearApp();
  });

  afterAll(async () => {
    execSync('docker compose start redis', { cwd: backendDir });
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.ping();
    await redis.quit();
    await app.close();
  });

  it('PA-08 error controlado sin reservas huérfanas', async () => {
    execSync('docker compose stop redis', { cwd: backendDir });
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 5 }],
      })
      .timeout(8000);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 50, reservado: 0 });
  });
});
