import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, sembrar, Semilla } from './helpers/semilla';

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

  describe('PA-21', () => {
    let app: INestApplication;
    let admin: SupabaseClient;
    let semilla: Semilla;
    let cuatroIds: string[];

    beforeAll(async () => {
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
          nombre: `PA21-${base}-${i}`,
          nit: `PA21-${base}-${i}`,
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
    });

    it('PA-21 cálculo de ruta con motor real', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/despachos/calcular-ruta')
        .set('Authorization', `Bearer ${semilla.despachador.token}`)
        .send({
          bodega_id: semilla.bodegaId,
          pedido_ids: cuatroIds,
          salida_prevista: '2026-10-10T15:00:00.000Z',
        });
      if (res.status === 502) {
        throw new Error('BLOQUEADO: el motor de rutas respondió 502. No se inventa distancia ni ETA.');
      }
      expect(res.status).toBe(200);
      expect(['osrm', 'google']).toContain(res.body.proveedor);
      expect(res.body.paradas).toHaveLength(4);
      const etas = res.body.paradas.map((p: { eta: string }) => Date.parse(p.eta));
      for (let i = 1; i < etas.length; i++) expect(etas[i]).toBeGreaterThan(etas[i - 1]);
    });
  });

  describe('PA-23 y PA-24', () => {
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

    it('PA-23 pedido ya asignado a otra ruta', async () => {
      const productoId = await crearProducto(admin, `PA23-${Date.now()}`, 10, semilla.bodegaId, 100);
      const pedido = await request(app.getHttpServer()).post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 1 }] });
      expect(pedido.status).toBe(201);
      const cuerpo = {
        vehiculo_id: semilla.vehiculoId, conductor_id: semilla.conductorId, bodega_id: semilla.bodegaId,
        paradas: [{ pedido_id: pedido.body.id, orden: 1 }],
      };
      const primero = await request(app.getHttpServer()).post('/api/v1/despachos')
        .set('Authorization', `Bearer ${semilla.despachador.token}`).send(cuerpo);
      expect(primero.status).toBe(201);
      const segundo = await request(app.getHttpServer()).post('/api/v1/despachos')
        .set('Authorization', `Bearer ${semilla.despachador.token}`).send(cuerpo);
      expect(segundo.status).toBe(409);
      const pg = new Client({ connectionString: process.env.DATABASE_URL });
      await pg.connect();
      try {
        const n = await pg.query('select count(*)::int as n from despacho_paradas where pedido_id = $1', [pedido.body.id]);
        expect(n.rows[0].n).toBe(1);
      } finally {
        await pg.end();
      }
    });

    it('PA-24 entrega de la última parada', async () => {
      const a = await crearProducto(admin, `PA24A-${Date.now()}`, 10, semilla.bodegaId, 100);
      const b = await crearProducto(admin, `PA24B-${Date.now()}`, 10, semilla.bodegaId, 100);
      const pedidos = [];
      for (const productoId of [a, b]) {
        const res = await request(app.getHttpServer()).post('/api/v1/pedidos')
          .set('Authorization', `Bearer ${semilla.asesor.token}`)
          .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 1 }] });
        expect(res.status).toBe(201);
        pedidos.push(res.body.id as string);
      }
      const despacho = await request(app.getHttpServer()).post('/api/v1/despachos')
        .set('Authorization', `Bearer ${semilla.despachador.token}`)
        .send({
          vehiculo_id: semilla.vehiculoId, conductor_id: semilla.conductorId, bodega_id: semilla.bodegaId,
          paradas: [{ pedido_id: pedidos[0], orden: 1 }, { pedido_id: pedidos[1], orden: 2 }],
        });
      expect(despacho.status).toBe(201);
      const paradas = [...despacho.body.paradas].sort((x, y) => x.orden - y.orden);
      const primera = await request(app.getHttpServer())
        .post(`/api/v1/despachos/${despacho.body.id}/paradas/${paradas[0].id}/entregar`)
        .set('Authorization', `Bearer ${semilla.despachador.token}`).send({});
      expect(primera.status).toBe(200);
      const ped1 = await admin.from('pedidos').select('estado').eq('id', paradas[0].pedido_id).single();
      expect(ped1.data!.estado).toBe('entregado');
      expect(primera.body.estado).not.toBe('finalizado');
      const segunda = await request(app.getHttpServer())
        .post(`/api/v1/despachos/${despacho.body.id}/paradas/${paradas[1].id}/entregar`)
        .set('Authorization', `Bearer ${semilla.despachador.token}`).send({});
      expect(segunda.status).toBe(200);
      expect(segunda.body.estado).toBe('finalizado');
      for (const id of pedidos) {
        const ped = await admin.from('pedidos').select('estado').eq('id', id).single();
        expect(ped.data!.estado).toBe('entregado');
      }
    });
  });
});
