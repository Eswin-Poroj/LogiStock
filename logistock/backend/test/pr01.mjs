import { readFileSync } from 'fs';
import { resolve } from 'path';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

globalThis.WebSocket = ws;

const envRuta = resolve(process.cwd(), '.env');
for (const linea of readFileSync(envRuta, 'utf8').split('\n')) {
  const limpia = linea.trim();
  if (!limpia || limpia.startsWith('#')) continue;
  const i = limpia.indexOf('=');
  if (i > 0 && process.env[limpia.slice(0, i)] === undefined) process.env[limpia.slice(0, i)] = limpia.slice(i + 1);
}
const u = process.env.SUPABASE_URL ?? '';
const d = process.env.DATABASE_URL ?? '';
if (!/127\.0\.0\.1|localhost/.test(u) || !/127\.0\.0\.1|localhost/.test(d) || u.includes('lrjoozqkydvzptuzskjz')) {
  console.error('ABORTADO', u);
  process.exit(1);
}
const admin = createClient(u, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const bodega = await admin.from('bodegas').select('id').eq('nombre', 'Bodega Pruebas Local').single();
const cliente = await admin.from('clientes').select('id').eq('nit', '1234567-8').single();
if (bodega.error || cliente.error || !bodega.data || !cliente.data) throw bodega.error ?? cliente.error ?? new Error('semilla no encontrada');
const bodega_id = bodega.data.id;
const cliente_id = cliente.data.id;
const productos = [];
for (let i = 0; i < 50; i++) {
  const sku = `PR01-${Date.now()}-${i}`;
  const ins = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 10, activo: true }).select('id').single();
  if (ins.error || !ins.data) throw ins.error ?? new Error('sin producto');
  const stock = await admin.from('stock').insert({ producto_id: ins.data.id, bodega_id, disponible: 100000, reservado: 0 });
  if (stock.error) throw stock.error;
  productos.push(ins.data.id);
}
const acceso = createClient(u, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sesion = await acceso.auth.signInWithPassword({ email: 'asesor.pruebas@logistock.local', password: 'ClavePruebas123' });
if (sesion.error || !sesion.data.session) throw sesion.error ?? new Error('sin sesion');
const token = sesion.data.session.access_token;

const fin = Date.now() + 60_000;
const muestras = [];
const statuses = [];
async function vu(i) {
  while (Date.now() < fin) {
    const t0 = performance.now();
    const res = await fetch('http://127.0.0.1:3000/api/v1/pedidos', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        cliente_id, bodega_id,
        lineas: [{ producto_id: productos[i], cantidad: 1 }],
      }),
    });
    muestras.push(performance.now() - t0);
    statuses.push(res.status);
  }
}
await Promise.all(Array.from({ length: 50 }, (_, i) => vu(i)));
const ord = [...muestras].sort((a, b) => a - b);
const p95 = ord[Math.min(ord.length - 1, Math.ceil(ord.length * 0.95) - 1)];
const errores5xx = statuses.filter((s) => s >= 500).length;
console.log(JSON.stringify({ solicitudes: statuses.length, p95_ms: p95, errores5xx }));
if (!(p95 < 800) || errores5xx !== 0) process.exit(1);
