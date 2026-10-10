import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA despachos', () => {
  describe('PA-22', () => {
    let app: INestApplication;
    let admin: SupabaseClient;
    let semilla: Semilla;
    let cuatroIds: string[];
    const osrmAnterior = process.env.OSRM_URL;

    beforeAll(async () => {
      process.env.OSRM_URL = 'http://127.0.0.1:9';
      assertEntornoLocal();
      admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      semilla = await sembrar(admin);
      cuatroIds = [];
      const base = Date.now();
      for (let i = 0; i < 4; i++) {
        const d = 0.01 * (i + 1);
        const cliente = await admin.from('clientes').insert({
          nombre: `PA22-${base}-${i}`,
          nit: `PA22-${base}-${i}`,
          direccion: 'Quetzaltenango',
          latitud: 14.834700 + d,
          longitud: -91.518100 + d,
        }).select('id').single();
        if (cliente.error || !cliente.data) throw cliente.error ?? new Error('sin cliente');
        const pedido = await admin.from('pedidos').insert({
          cliente_id: cliente.data.id,
          bodega_id: semilla.bodegaId,
          creado_por: semilla.asesor.id,
        }).select('id').single();
        if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
        cuatroIds.push(pedido.data.id as string);
      }
      app = await crearApp();
    });

    afterAll(async () => {
      await app.close();
      if (osrmAnterior === undefined) delete process.env.OSRM_URL;
      else process.env.OSRM_URL = osrmAnterior;
    });

    it('PA-22 OSRM y Google fallan con 502', async () => {
      const original = global.fetch;
      const urls: string[] = [];
      global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        urls.push(String(input));
        return original(input, init);
      }) as typeof fetch;
      try {
        const res = await request(app.getHttpServer())
          .post('/api/v1/despachos/calcular-ruta')
          .set('Authorization', `Bearer ${semilla.despachador.token}`)
          .send({ bodega_id: semilla.bodegaId, pedido_ids: cuatroIds, salida_prevista: '2026-10-10T15:00:00.000Z' });
        if (!urls.some((u) => u.includes('maps.googleapis.com'))) {
          throw new Error('BLOQUEADO: la URL de Google no se intentó. ' + urls.join(' | '));
        }
        expect(urls.some((u) => u.includes('127.0.0.1:9'))).toBe(true);
        expect(res.status).toBe(502);
        expect(res.body.distancia_km).toBeUndefined();
        expect(JSON.stringify(res.body)).toContain('El motor de rutas no respondió');
      } finally {
        global.fetch = original;
      }
    });
  });
});
