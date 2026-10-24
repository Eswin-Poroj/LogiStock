import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, pickingCompletado, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

/** Reglas del RUP: CU-01 A2, CU-04 A1, CU-05 E2 y CU-06 A2. */
describe('Reglas del RUP', () => {
  let app: INestApplication;
  let admin: SupabaseClient;
  let semilla: Semilla;

  beforeAll(async () => {
    assertEntornoLocal();
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    semilla = await sembrar(admin);
    app = await crearApp();
  });
  afterAll(async () => { await app.close(); });

  const pedido = (token: string, productoId: string, cantidad: number, extra: object = {}) =>
    request(app.getHttpServer()).post('/api/v1/pedidos').set('Authorization', `Bearer ${token}`)
      .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad }], ...extra });

  it('CU-01 A2 descuento sobre el máximo exige un administrador', async () => {
    const productoId = await crearProducto(admin, `RUP01-${Date.now()}`, 100, semilla.bodegaId, 10);
    const sin = await pedido(semilla.asesor.token, productoId, 1, { descuento_pct: 15 });
    expect(sin.status).toBe(403);
    expect(sin.body.requiere_autorizacion).toBe(true);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 10, reservado: 0 });
    const operario = await pedido(semilla.asesor.token, productoId, 1, { descuento_pct: 15, autorizacion: { correo: semilla.operario.correo, clave: semilla.operario.clave } });
    expect(operario.status).toBe(403);
    const ok = await pedido(semilla.asesor.token, productoId, 1, { descuento_pct: 15, autorizacion: { correo: semilla.admin.correo, clave: semilla.admin.clave } });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ descuento_pct: 15, descuento: 15, autorizado_por: 'Admin Pruebas' });
    expect(Number(ok.body.total)).toBeCloseTo(95.2, 2);
  });

  it('CU-04 A1 ajuste grande queda pendiente hasta que el administrador lo aprueba', async () => {
    const productoId = await crearProducto(admin, `RUP04-${Date.now()}`, 10, semilla.bodegaId, 50);
    const res = await request(app.getHttpServer()).post('/api/v1/inventario/ajustes').set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({ producto_id: productoId, bodega_id: semilla.bodegaId, tipo: 'ajuste', cantidad: 30, motivo: 'conteo' });
    expect(res.status).toBe(201);
    expect(res.body.pendiente).toBe(true);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 50 });
    const negado = await request(app.getHttpServer()).post(`/api/v1/inventario/ajustes/${res.body.id}/aprobar`).set('Authorization', `Bearer ${semilla.operario.token}`);
    expect(negado.status).toBe(403);
    const aprobado = await request(app.getHttpServer()).post(`/api/v1/inventario/ajustes/${res.body.id}/aprobar`).set('Authorization', `Bearer ${semilla.admin.token}`);
    expect(aprobado.status).toBe(200);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 80 });
  });

  it('CU-05 E2 el picking con faltante avisa al asesor que creó el pedido', async () => {
    const productoId = await crearProducto(admin, `RUP05-${Date.now()}`, 10, semilla.bodegaId, 10);
    const creado = await pedido(semilla.asesor.token, productoId, 4);
    expect(creado.status).toBe(201);
    let tarea: { id: string } | undefined;
    for (let i = 0; i < 20 && !tarea; i++) {
      const lista = await request(app.getHttpServer()).get('/api/v1/picking/tareas').set('Authorization', `Bearer ${semilla.operario.token}`);
      tarea = lista.body.find((t: { pedido_id: string }) => t.pedido_id === creado.body.id);
      if (!tarea) await new Promise((r) => setTimeout(r, 250));
    }
    expect(tarea).toBeDefined();
    const cierre = await request(app.getHttpServer()).post(`/api/v1/picking/tareas/${tarea!.id}/completar`).set('Authorization', `Bearer ${semilla.operario.token}`).send({ faltante: true });
    expect(cierre.body.estado).toBe('con_faltante');
    const avisos = await request(app.getHttpServer()).get('/api/v1/notificaciones').set('Authorization', `Bearer ${semilla.asesor.token}`);
    expect(avisos.body.some((n: { pedido_id: string; tipo: string }) => n.pedido_id === creado.body.id && n.tipo === 'picking_faltante')).toBe(true);
  });

  it('CU-06 A2 la sobrecarga del vehículo se advierte y solo se asigna confirmándola', async () => {
    const productoId = await crearProducto(admin, `RUP06-${Date.now()}`, 10, semilla.bodegaId, 50);
    await admin.from('productos').update({ peso_kg: 100 }).eq('id', productoId);
    const creado = await pedido(semilla.asesor.token, productoId, 11);
    await pickingCompletado(admin, creado.body.id);
    const cuerpo = { vehiculo_id: semilla.vehiculoId, conductor_id: semilla.conductorId, bodega_id: semilla.bodegaId, paradas: [{ pedido_id: creado.body.id, orden: 1 }] };
    const rechazo = await request(app.getHttpServer()).post('/api/v1/despachos').set('Authorization', `Bearer ${semilla.despachador.token}`).send(cuerpo);
    expect(rechazo.status).toBe(409);
    expect(rechazo.body).toMatchObject({ excede_capacidad: true, carga_kg: 1100, capacidad_kg: 1000 });
    const confirmado = await request(app.getHttpServer()).post('/api/v1/despachos').set('Authorization', `Bearer ${semilla.despachador.token}`).send({ ...cuerpo, aceptar_exceso: true });
    expect(confirmado.status).toBe(201);
  });
});
