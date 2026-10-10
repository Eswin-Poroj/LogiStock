/**
 * Prueba de concurrencia del riesgo R1 (reserva de stock).
 * Requiere .env con Supabase (schema.sql aplicado), Redis y datos de prueba:
 *   E2E_TOKEN, E2E_CLIENTE_ID, E2E_BODEGA_ID, E2E_PRODUCTO_ID  (producto con stock disponible = 100)
 * Lanza 5 pedidos simultáneos de 30 unidades: deben ganar exactamente 3 y fallar 2 (409 o 423).
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const listo = process.env.E2E_TOKEN && process.env.E2E_PRODUCTO_ID;
(listo ? describe : describe.skip)('Reserva de stock concurrente (R1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it('nunca reserva más unidades de las disponibles', async () => {
    const crear = () =>
      request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${process.env.E2E_TOKEN}`)
        .send({
          cliente_id: process.env.E2E_CLIENTE_ID,
          bodega_id: process.env.E2E_BODEGA_ID,
          lineas: [{ producto_id: process.env.E2E_PRODUCTO_ID, cantidad: 30 }],
        });

    const respuestas = await Promise.all(Array.from({ length: 5 }, crear));
    const creados = respuestas.filter((r) => r.status === 201).length;
    const rechazados = respuestas.filter((r) => [409, 423].includes(r.status)).length;

    expect(creados).toBe(3);
    expect(rechazados).toBe(2);
  });
});
