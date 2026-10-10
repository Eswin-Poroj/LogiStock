import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

(globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
  ws as unknown as typeof WebSocket;

const CLAVE = 'ClavePruebas123';

export interface Actor {
  id: string;
  correo: string;
  clave: string;
  token: string;
  refresh: string;
  rol: 'asesor_ventas' | 'operario_bodega' | 'despachador' | 'administrador';
}

export interface Semilla {
  bodegaId: string;
  clienteId: string;
  proveedorId: string;
  vehiculoId: string;
  conductorId: string;
  asesor: Actor;
  operario: Actor;
  despachador: Actor;
  admin: Actor;
}

async function idDe(admin: SupabaseClient, tabla: string, columna: string, valor: string, fila: Record<string, unknown>): Promise<string> {
  const ya = await admin.from(tabla).select('id').eq(columna, valor).maybeSingle();
  if (ya.error) throw ya.error;
  if (ya.data) return ya.data.id as string;
  const ins = await admin.from(tabla).insert(fila).select('id').single();
  if (ins.error || !ins.data) throw ins.error ?? new Error(`sin ${tabla}`);
  return ins.data.id as string;
}

async function actor(admin: SupabaseClient, correo: string, nombre: string, rol: Actor['rol'], bodegaId: string): Promise<Actor> {
  const clave = CLAVE;
  const { error } = await admin.auth.admin.createUser({
    email: correo, password: clave, email_confirm: true,
  });
  if (error && !/already|registered/i.test(error.message)) throw error;
  const acceso = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sesion, error: eLogin } = await acceso.auth.signInWithPassword({ email: correo, password: clave });
  if (eLogin || !sesion.session || !sesion.user) throw eLogin ?? new Error('sin sesion');
  const up = await admin.from('usuarios').upsert({
    id: sesion.user.id, nombre, rol, activo: true, bodega_id: bodegaId,
  });
  if (up.error) throw up.error;
  return {
    id: sesion.user.id, correo, clave, rol,
    token: sesion.session.access_token,
    refresh: sesion.session.refresh_token,
  };
}

export async function sembrar(admin: SupabaseClient): Promise<Semilla> {
  const bodegaId = await idDe(admin, 'bodegas', 'nombre', 'Bodega Pruebas Local', {
    nombre: 'Bodega Pruebas Local', direccion: 'Quetzaltenango',
    latitud: 14.834700, longitud: -91.518100, activa: true,
  });
  const clienteId = await idDe(admin, 'clientes', 'nit', '1234567-8', {
    nombre: 'Cliente Pruebas', nit: '1234567-8', direccion: 'Quetzaltenango',
    latitud: 14.834700, longitud: -91.518100,
  });
  const proveedorId = await idDe(admin, 'proveedores', 'nit', 'PROV-PRUEBAS', {
    nombre: 'Proveedor Pruebas', nit: 'PROV-PRUEBAS',
  });
  const vehiculoId = await idDe(admin, 'vehiculos', 'placa', 'P-001TST', {
    nombre: 'Vehiculo Pruebas', placa: 'P-001TST', capacidad_kg: 1000, activo: true,
  });
  const conductorId = await idDe(admin, 'conductores', 'nombre', 'Conductor Pruebas', {
    nombre: 'Conductor Pruebas', activo: true,
  });
  const adminActor = await actor(admin, 'admin.pruebas@logistock.local', 'Admin Pruebas', 'administrador', bodegaId);
  const asesor = await actor(admin, 'asesor.pruebas@logistock.local', 'Asesor Pruebas', 'asesor_ventas', bodegaId);
  const operario = await actor(admin, 'operario.pruebas@logistock.local', 'Operario Pruebas', 'operario_bodega', bodegaId);
  const despachador = await actor(admin, 'despacho.pruebas@logistock.local', 'Despachador Pruebas', 'despachador', bodegaId);
  return { bodegaId, clienteId, proveedorId, vehiculoId, conductorId, admin: adminActor, asesor, operario, despachador };
}

export async function crearProducto(admin: SupabaseClient, sku: string, precio: number, bodegaId: string, disponible: number): Promise<string> {
  const ins = await admin.from('productos').insert({
    sku, nombre: sku, precio_unitario: precio, activo: true,
  }).select('id').single();
  if (ins.error || !ins.data) throw ins.error ?? new Error('sin producto');
  const stock = await admin.from('stock').insert({
    producto_id: ins.data.id, bodega_id: bodegaId, disponible, reservado: 0,
  });
  if (stock.error) throw stock.error;
  return ins.data.id as string;
}

export async function ponerStock(admin: SupabaseClient, productoId: string, bodegaId: string, disponible: number, reservado = 0): Promise<void> {
  const upd = await admin.from('stock').update({ disponible, reservado }).eq('producto_id', productoId).eq('bodega_id', bodegaId);
  if (upd.error) throw upd.error;
}

export async function leerStock(admin: SupabaseClient, productoId: string, bodegaId: string): Promise<{ disponible: number; reservado: number; danado: number }> {
  const { data, error } = await admin.from('stock').select('disponible, reservado, danado').eq('producto_id', productoId).eq('bodega_id', bodegaId).single();
  if (error || !data) throw error ?? new Error('sin stock');
  return { disponible: Number(data.disponible), reservado: Number(data.reservado), danado: Number(data.danado) };
}
