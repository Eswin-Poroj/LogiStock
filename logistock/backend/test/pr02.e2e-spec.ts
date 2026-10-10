import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, ponerStock, sembrar, Semilla, tokenFresco } from './helpers/semilla';

jest.setTimeout(120000);

describe('PR-02', () => {
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
    productoId = await crearProducto(admin, `PR02-${Date.now()}`, 10, semilla.bodegaId, 10);
    app = await crearApp();
  });
  afterAll(async () => { await app.close(); });

  it('no altera la ventana del lock', () => {
    const src = readFileSync(resolve(__dirname, '../src/common/redis/lock.service.ts'), 'utf8');
    expect(src).toContain('retryCount: 5');
    expect(src).toContain('retryDelay: 100');
    expect(src).toContain('retryJitter: 50');
    expect(process.env.LOCK_TTL_MS ?? '5000').toBe('5000');
  });

  it('PR-02 cien solicitudes al mismo SKU', async () => {
    await ponerStock(admin, productoId, semilla.bodegaId, 10, 0);
    const token = await tokenFresco(semilla.asesor);
    const respuestas = await Promise.all(Array.from({ length: 100 }, () =>
      request(app.getHttpServer()).post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${token}`)
        .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 1 }] }),
    ));
    const aceptadas = respuestas.filter((r) => r.status === 201).length;
    const rechazadas = respuestas.filter((r) => r.status === 409 || r.status === 423).length;
    const server = respuestas.filter((r) => r.status >= 500).length;
    const distintos = [...new Set(respuestas.map((r) => r.status))];
    const stock = await leerStock(admin, productoId, semilla.bodegaId);
    console.log(JSON.stringify({ aceptadas, rechazadas, server, distintos, stock }));
    expect(server).toBe(0);
    expect(aceptadas).toBe(10);
    expect(rechazadas).toBe(90);
    expect(stock.disponible).toBeGreaterThanOrEqual(0);
    expect(stock.reservado).toBe(aceptadas);
    expect(stock.disponible + stock.reservado).toBe(10);
  });
});
