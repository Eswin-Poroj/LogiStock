# Ejecución de las pruebas de la sección 3.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ejecutar de verdad los 42 casos del plan de pruebas de LogiStock y dejar resultados reales en docs/resultados_pruebas.md.

**Architecture:** Una sola base, Supabase local, con Redis del compose que ya existe. Se implementan solo los endpoints que un caso llama; el resto sigue en 501. Sin comando, el estado es Bloqueado o No ejecutable: no se inventan cifras, distancias ni pantallas.

**Tech Stack:** NestJS, PostgreSQL 16 vía Supabase local, Redis, Jest, supertest, pg, Redlock.

## Global Constraints

- No inventar resultados. Sin comando, el estado es Bloqueado o No ejecutable.
- No cambiar IDs ni criterios de aceptación de la sección 3.4.
- No cambiar la lógica de reserva para que un caso pase. Corregir código solo después de ver el fallo y solo si el defecto es claro.
- La corrida de pruebas usa solo 127.0.0.1 o localhost. assertEntornoLocal() aborta cualquier otro host. No usar el proyecto Supabase alojado lrjoozqkydvzptuzskjz para estas pruebas.
- IVA_PORCENTAJE=12. Lock retryCount 5, retryDelay 100, retryJitter 50, LOCK_TTL_MS 5000. No subirlos para PR-02 o PA-10.
- PU-01 a PU-04: No ejecutable: sin frontend.
- Endpoints que ningún caso observa siguen en 501 (reportes, listar picking, listar despachos, iniciar despacho, ajuste positivo).
- Todo el plan y los resultados en español.

---

## Review Focus

Estas cinco condiciones están en el blueprint y se fijan en la tarea indicada. No son casos nuevos de la sección 3.4.

- Host distinto de `localhost` o `127.0.0.1`, o URL que contenga `lrjoozqkydvzptuzskjz`: no se llama a la API. Lo fija el `it` de T3 junto a `assertEntornoLocal`.
- `POST /inventario/ajustes` con cantidad positiva sigue en 501 y no mueve el stock. Lo fija el `it` de T16.
- El asesor en `GET /reportes/resumen` recibe 403. Si llega 501, PS-04 Falló. Lo fija el `it` de T22.
- Cien POST sobre el mismo SKU no autorizan a cambiar `retryCount`, `retryDelay`, `retryJitter` ni `LOCK_TTL_MS`. Lo fija el `it` de guarda de T23.
- No hay interfaz en `logistock/`. PU-01 a PU-04 se documentan No ejecutable. Lo fija T25. No se crea una página para marcarlos aprobados.

## Mapa de archivos

Rutas relativas a `logistock/`. Un archivo, una responsabilidad. Los 501 que ningún caso ejecuta se quedan como están.

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/src/common/redis/lock.service.ts` | Modificar | El 423 se escribe como número: `HttpStatus.LOCKED` no existe en NestJS 10. No se anota `Lock` ni se toca el acquire. Solo si PA-08 se cuelga: opciones del Redis del lock. |
| `backend/nest-cli.json` | Modificar solo si `nest build` rechaza el plugin string | `plugins: [{ "name": "@nestjs/swagger" }]`. |
| `backend/.env.example` | Modificar | Placeholders locales: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`. Sin llaves reales. |
| `backend/package.json` | Modificar | DevDependencies `pg`, `@types/pg`. Scripts `test:pb`, `test:pa`, `test:ps`, `test:pr02`, `test:pr01`. |
| `db/grants_local.sql` | Crear | `GRANT` de tablas, secuencias y `rol_actual()` a `service_role` y `authenticated` en la base local. |
| `backend/test/helpers/local.ts` | Crear | `assertEntornoLocal()` y `crearApp()`. |
| `backend/test/helpers/semilla.ts` | Crear | Usuarios, bodega, cliente, proveedor, vehículo, conductor, producto con stock. |
| `backend/test/pb.e2e-spec.ts` | Crear | PB-01 a PB-06 con `pg`. |
| `backend/src/modules/pedidos/cola-picking.ts` | Crear, antes del primer e2e | `export const COLA_PICKING = 'picking'`. Rompe el ciclo que deja el token de `InjectQueue` en `undefined`. |
| `backend/src/modules/pedidos/pedidos.module.ts` | Modificar, antes del primer e2e | Importa `COLA_PICKING` desde `./cola-picking` y lo reexporta. `picking.module.ts` y `picking.processor.ts` siguen importando desde `pedidos.module`. |
| `backend/src/modules/pedidos/pedidos.service.ts` | Modificar | En T5 solo cambia el import de `COLA_PICKING` a `./cola-picking`. El 400 que nombra los `producto_id` se toca solo después de que PA-06 falle. |
| `backend/src/modules/pedidos/pedidos.service.spec.ts` | Modificar | PA-02 con disponible 18 y `lineas_sin_stock`. |
| `backend/src/modules/pedidos/pedidos.compensacion.spec.ts` | Crear | PA-09 con el mock del servicio, además del e2e con trigger. |
| `backend/test/stock.concurrency.e2e-spec.ts` | Modificar | Quitar el `describe.skip`, reponer stock 100, afirmar 3 y 2. |
| `backend/test/pa-pedidos.e2e-spec.ts` | Crear | PA-01 a PA-07, PA-09, PA-11 a PA-13 por HTTP. |
| `backend/test/pa-08-redis.e2e-spec.ts` | Crear | PA-08, y vuelve a levantar Redis. |
| `backend/src/modules/inventario/inventario.dto.ts` | Crear | `EntradaNuevaDto`, `AjusteNuevoDto`. |
| `backend/src/modules/inventario/inventario.service.ts` | Modificar | `registrarEntrada`, `registrarAjuste`, `registrarDanio`. |
| `backend/src/modules/inventario/inventario.controller.ts` | Modificar | Conectar los dos POST al servicio. |
| `backend/test/pa-inventario.e2e-spec.ts` | Crear | PA-15, PA-16, PA-17. |
| `backend/src/modules/picking/picking.dto.ts` | Crear | `EscaneoNuevoDto`, `CompletarPickingDto`. |
| `backend/src/modules/picking/picking.service.ts` | Crear | `obtener`, `escanear`, `completar`. |
| `backend/src/modules/picking/picking.controller.ts` | Modificar | Esas tres rutas. `listar()` sigue en 501. |
| `backend/src/modules/picking/picking.module.ts` | Modificar | Registrar `PickingService`. |
| `backend/test/pa-picking.e2e-spec.ts` | Crear | PA-14, PA-18, PA-19, PA-20. |
| `backend/src/modules/despachos/despachos.dto.ts` | Crear | `DespachoNuevoDto`, `RutaSolicitudDto`. |
| `backend/src/modules/despachos/rutas.client.ts` | Crear | OSRM y, si falla, Google. `null` si ambos fallan. |
| `backend/src/modules/despachos/despachos.service.ts` | Crear | `calcularRuta`, `crear`, `obtener`, `entregar`. |
| `backend/src/modules/despachos/despachos.controller.ts` | Modificar | Esas cuatro rutas. `listar` e `iniciar` siguen en 501. |
| `backend/src/modules/despachos/despachos.module.ts` | Modificar | Registrar servicio y cliente de rutas. |
| `backend/test/pa-despachos.e2e-spec.ts` | Crear | PA-21, PA-22, PA-23, PA-24. |
| `backend/test/ps.e2e-spec.ts` | Crear | PS-01 a PS-06. |
| `backend/test/pr02.e2e-spec.ts` | Crear | PR-02. |
| `backend/test/pr01.mjs` | Crear | PR-01, 50 trabajadores, 60 s, p95. |
| `docs/resultados_pruebas.md` | Crear al final | Solo cifras y status copiados de la salida de los comandos. |

Los commits se ejecutan desde `logistock/`. Git está en el directorio padre y acepta estas rutas.

## Casos y estado previsto

El estado del RUP (Ejecutada / Escrita / Pendiente) no se copia a `docs/resultados_pruebas.md`. Ese archivo solo puede decir Aprobado, Falló, Bloqueado o No ejecutable después de una corrida real. La columna Previsto de abajo no se copia hasta que el comando exista.

| Casos | Previsto |
|---|---|
| PB-01 a PB-06, PA-01 a PA-05, PA-07, PA-09, PA-11 a PA-20, PA-23, PA-24, PS-01 a PS-05 | Ejecutables. Se aprueban solo si la salida cumple el criterio literal. |
| PA-06 | El primer intento puede Fallar; se corrige el mensaje y se vuelve a correr. |
| PA-08 | Puede Fallar por cuelgue; la corrección es solo el cliente Redis del lock, y se vuelve a correr. |
| PA-10 | Ejecutable. Si no salen 3 y 2, Falló con los status reales. |
| PA-14 | Ejecutable. El `insert` idempotente se escribe solo si el upsert deja cero tareas. |
| PA-21 | Bloqueado mientras calcular-ruta responda 502. |
| PA-22 | Ejecutable si el spy ve las dos URLs y el status es 502. Si Google no se intentó, Bloqueado. |
| PS-06 | Bloqueado mientras reportes responda 501. |
| PR-01 | Ejecutable. p95 ≥ 800 o cualquier 5xx es Falló. |
| PR-02 | Ejecutable y con alta probabilidad de Fallar el “exactamente 10”, porque el lock se rinde cerca de 0.5 s. La sobreventa se mide aparte y también se anota. |
| PU-01 a PU-04 | No ejecutable: sin frontend. |

Queda fuera, porque ningún caso lo observa sin inventar cifras o pantallas: `GET /reportes/resumen`, `GET /reportes/mas-vendidos`, `GET /reportes/alertas-stock`; `GET /picking/tareas`; `GET /despachos` y `POST /despachos/:id/iniciar`; el camino feliz de `POST /inventario/ajustes` con cantidad positiva; una función SQL nueva de daño o de ajuste; un contenedor OSRM con respuesta escrita a mano; pantallas, sustitutos y el botón Confirmar. `retryCount`, `retryDelay` y `LOCK_TTL_MS` no se cambian para que PR-02 o PA-10 cuadren. No se toca una base cuyo host no sea local.

---

### Task 1: Compilar, sin tocar la reserva

**Files:**
- Modify: `backend/src/common/redis/lock.service.ts`
- Modify: `backend/nest-cli.json` (solo si el build rechaza el plugin string)

**Interfaces:**
- Consumes: ninguna
- Produces: `LockService.conLocks` sigue con `retryCount: 5`, `retryDelay: 100`, `retryJitter: 50` y el TTL de `LOCK_TTL_MS`. El 423 es el número literal. No se anota `Lock` y no cambia la lógica del `acquire`.

- [x] **Step 1: Instalar y compilar**

Desde `logistock/`:

```bash
cd backend && npm install && npm run build
```

Expected: FAIL. `tsc` y Jest fallan solo en `src/common/redis/lock.service.ts`: `HttpStatus.LOCKED` no existe en NestJS 10 (el enum salta de 422 a 424). No es `let lock` ni TS7034.

- [x] **Step 2: Escribir el 423 literal**

En `backend/src/common/redis/lock.service.ts`, quita `HttpStatus` del import. No anotes `Lock`. No toques `retryCount`, `retryDelay`, `retryJitter`, el TTL ni la lógica del `acquire`. El 423 es el código que ya documentan el comentario, OpenAPI y el e2e.

```typescript
import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
```

```typescript
      throw new HttpException(
        'El producto está siendo reservado por otra operación. Intenta de nuevo.',
        423,
      );
```

- [x] **Step 3: Volver a compilar**

```bash
cd backend && npm run build
```

Expected: el comando termina sin errores. Equivale a `npx tsc --noEmit -p tsconfig.build.json` sin errores.

Si el plugin de Swagger en `nest-cli.json` rompe el build, `compilerOptions.plugins` pasa a:

```json
[{ "name": "@nestjs/swagger" }]
```

y se vuelve a correr el mismo comando. Expected: sin errores.

- [x] **Step 4: Commit**

```bash
git add backend/src/common/redis/lock.service.ts
git commit -m "Usa 423 literal porque HttpStatus.LOCKED no existe en NestJS 10."
```

Si `nest-cli.json` cambió en el paso 3, agrégalo en el mismo commit.

### Task 2: Grants, ejemplo de entorno y el freno local

**Files:**
- Create: `db/grants_local.sql`
- Modify: `backend/.env.example`
- Create: `backend/test/helpers/local.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: ninguna
- Produces:
  - `export function assertEntornoLocal(): void`
  - `export async function crearApp(): Promise<INestApplication>`

- [x] **Step 1: Levantar Supabase local y anotar la versión**

Desde `logistock/`. No se copia ninguna clave del dashboard de un proyecto alojado.

```bash
cd "/Users/eswinporoj/Documents/2026/UMG/OCTAVO SEMESTRE/ANALISIS DE SISTEMAS/software/logistock"
npx supabase init
npx supabase start
npx supabase status -o env
```

De esa salida salen `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` y `DB_URL`. Se copian al `backend/.env` con los nombres de abajo. `supabase status` también imprime la versión vía:

```bash
psql "$DB_URL" -c "select version();"
```

Expected: una cadena de versión. Esa cadena es la evidencia de los PB. Si la imagen local no es PostgreSQL 16, se escribe la versión que devolvió el comando. No se inventa “PostgreSQL 16” si el comando dijo otra cosa.

- [x] **Step 2: Escribir grants, el ejemplo y el .env de la corrida**

`db/grants_local.sql`:

```sql
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select on all tables in schema public to authenticated;
grant execute on function public.rol_actual() to authenticated;
```

`backend/.env.example` queda con placeholders locales, sin la URL `https://TU-PROYECTO.supabase.co` y sin llaves reales:

```text
PORT=3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<ANON_KEY de supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY de supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
REDIS_URL=redis://127.0.0.1:6379
OSRM_URL=http://127.0.0.1:5000
GOOGLE_DIRECTIONS_API_KEY=
IVA_PORCENTAJE=12
LOCK_TTL_MS=5000
```

`backend/.env` de la corrida usa los valores reales de `supabase status` en esta máquina. No se commitea. Forma:

```text
PORT=3000
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<ANON_KEY de supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY de supabase status>
DATABASE_URL=<DB_URL de supabase status>
REDIS_URL=redis://127.0.0.1:6379
OSRM_URL=http://127.0.0.1:5000
GOOGLE_DIRECTIONS_API_KEY=
IVA_PORCENTAJE=12
LOCK_TTL_MS=5000
```

Si el puerto de `DB_URL` o de `API_URL` no es 54322 o 54321, se usa el que imprimió `supabase status`. El host tiene que ser `127.0.0.1` o `localhost`.

En `backend/package.json`, devDependencies `pg` y `@types/pg`, y estos scripts:

```json
"test:pb": "jest --config ./test/jest-e2e.json --testPathPattern pb.e2e",
"test:pa": "jest --config ./test/jest-e2e.json --testPathPattern pa-",
"test:ps": "jest --config ./test/jest-e2e.json --testPathPattern ps.e2e",
"test:pr02": "jest --config ./test/jest-e2e.json --testPathPattern pr02.e2e",
"test:pr01": "node test/pr01.mjs"
```

- [x] **Step 3: Aplicar schema, grants y Redis**

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f db/grants_local.sql
cd backend && docker compose up -d
docker compose ps
```

Expected: `schema.sql` y `grants_local.sql` terminan sin error. `docker compose ps` muestra `redis` en marcha. Si el 6379 está ocupado por otro Redis, no se reutiliza: se libera el puerto o se cambia a la vez el puerto del compose y `REDIS_URL`.

- [x] **Step 4: Escribir el freno local**

`backend/test/helpers/local.ts`. `assertEntornoLocal` lanza `Error('ABORTADO: la base no es local')` si `SUPABASE_URL` o `DATABASE_URL` no contienen `localhost` ni `127.0.0.1`, o si contienen `lrjoozqkydvzptuzskjz`. Antes lee `backend/.env` (el cwd de Jest es `backend/`) solo para claves que todavía no están en `process.env`, porque `ConfigModule` carga ese archivo al arrancar Nest y esta función corre antes.

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

function cargarEnvSiFalta(): void {
  let texto = '';
  try {
    texto = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  } catch {
    return;
  }
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i < 1) continue;
    const clave = limpia.slice(0, i);
    if (process.env[clave] === undefined) process.env[clave] = limpia.slice(i + 1);
  }
}

export function assertEntornoLocal(): void {
  cargarEnvSiFalta();
  const u = process.env.SUPABASE_URL ?? '';
  const d = process.env.DATABASE_URL ?? '';
  const ok = (s: string) => /127\.0\.0\.1|localhost/.test(s);
  if (!ok(u) || !ok(d) || u.includes('lrjoozqkydvzptuzskjz') || d.includes('lrjoozqkydvzptuzskjz')) {
    throw new Error('ABORTADO: la base no es local');
  }
}

export async function crearApp(): Promise<INestApplication> {
  assertEntornoLocal();
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}
```

- [x] **Step 5: Comprobar el host e instalar pg**

Desde `logistock/backend`, con el `.env` ya escrito. Este node no carga `.env` solo: exportar antes las dos variables desde ese archivo, o ejecutar el bloque después de `set -a && source .env && set +a`.

```bash
cd backend
node -e "
const u=process.env.SUPABASE_URL||''; const d=process.env.DATABASE_URL||'';
const ok=(s)=>/127\\.0\\.0\\.1|localhost/.test(s);
if(!ok(u)||!ok(d)){ console.error('ABORTADO', u, d); process.exit(1); }
console.log('local', u);
"
npm install
npm run build
```

Expected: imprime `local` y una URL con `127.0.0.1` o `localhost`, y el build sale 0. Si imprime `ABORTADO`, no se sigue.

- [x] **Step 6: Commit**

```bash
git add db/grants_local.sql backend/.env.example backend/test/helpers/local.ts backend/package.json backend/package-lock.json
git commit -m "Deja el entorno de pruebas atado a Supabase y Redis locales."
```

No agregar `backend/.env`.

### Task 3: Semilla y los seis casos de base

**Files:**
- Create: `backend/test/helpers/semilla.ts`
- Create: `backend/test/pb.e2e-spec.ts`
- Test: `backend/test/pb.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertEntornoLocal(): void`
- Produces:

```typescript
export interface Actor {
  id: string
  correo: string
  clave: string
  token: string
  refresh: string
  rol: 'asesor_ventas' | 'operario_bodega' | 'despachador' | 'administrador'
}
export interface Semilla {
  bodegaId: string
  clienteId: string
  proveedorId: string
  vehiculoId: string
  conductorId: string
  asesor: Actor
  operario: Actor
  despachador: Actor
  admin: Actor
}
export async function sembrar(admin: SupabaseClient): Promise<Semilla>
export async function crearProducto(admin: SupabaseClient, sku: string, precio: number, bodegaId: string, disponible: number): Promise<string>
export async function ponerStock(admin: SupabaseClient, productoId: string, bodegaId: string, disponible: number, reservado?: number): Promise<void>
export async function leerStock(admin: SupabaseClient, productoId: string, bodegaId: string): Promise<{ disponible: number; reservado: number; danado: number }>
```

Usuarios que crea `sembrar` solo en esa base, clave `ClavePruebas123`:

| Correo | Rol |
|---|---|
| admin.pruebas@logistock.local | administrador |
| asesor.pruebas@logistock.local | asesor_ventas |
| operario.pruebas@logistock.local | operario_bodega |
| despacho.pruebas@logistock.local | despachador |

Bodega: latitud `14.834700`, longitud `-91.518100`, nombre `Bodega Pruebas Local`. Cliente NIT `1234567-8` con las mismas coordenadas. Vehículo `capacidad_kg` 1000. Esas coordenadas son datos, no una ruta calculada a mano.

- [x] **Step 1: Escribir la semilla**

`backend/test/helpers/semilla.ts`. El alta de sesión usa un cliente con la anon key para no pisar la service role del cliente `admin`. El alta del usuario en Auth sigue en `admin`.

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
```

Si `createUser` falla por el esquema `auth`, se detiene aquí y todo lo que depende de usuarios queda Bloqueado con el mensaje de GoTrue. No se borra la FK `usuarios.id → auth.users`.

- [x] **Step 2: Escribir PB-01 a PB-06**

`backend/test/pb.e2e-spec.ts`. Cada `it` lleva el criterio literal. `p_usuario` puede ser null. Cinco llamadas simultáneas usan cinco conexiones: un solo `Client` de `pg` no corre queries en paralelo. `nextval` no se revierte con ROLLBACK; `setval('pedido_numero_seq', 1, false)` va inmediatamente antes de los dos INSERT y solo corre si `assertEntornoLocal()` ya pasó. En la evidencia de PB-05 se anota que la secuencia local quedó adelantada.

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { assertEntornoLocal } from './helpers/local';
import { sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

async function conPg<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  assertEntornoLocal();
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

describe('PB base de datos', () => {
  let admin: SupabaseClient;
  let semilla: Semilla;

  beforeAll(async () => {
    assertEntornoLocal();
    admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    semilla = await sembrar(admin);
  });

  it('aborta si el host no es local', () => {
    const previaU = process.env.SUPABASE_URL;
    const previaD = process.env.DATABASE_URL;
    process.env.SUPABASE_URL = 'https://lrjoozqkydvzptuzskjz.supabase.co';
    try {
      expect(() => assertEntornoLocal()).toThrow('ABORTADO: la base no es local');
    } finally {
      process.env.SUPABASE_URL = previaU;
      process.env.DATABASE_URL = previaD;
    }
  });

  it('PB-01 reserva simultánea sin sobreventa', async () => {
    // Criterio: 3 devuelven true, 2 devuelven false. Quedan 10 disponibles y 90 reservados.
    const sku = `PB01-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    const stock = await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 100, reservado: 0 }).select('id').single();
    if (stock.error) throw stock.error;
    const resultados = await Promise.all(Array.from({ length: 5 }, () => conPg(async (c) => {
      const r = await c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 30, 'PB-01', null]);
      return r.rows[0].ok as boolean;
    })));
    const trues = resultados.filter(Boolean).length;
    expect(trues).toBe(3);
    expect(resultados.filter((ok) => !ok).length).toBe(2);
    const queda = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId).single();
    expect(Number(queda.data!.disponible)).toBe(10);
    expect(Number(queda.data!.reservado)).toBe(90);
  });

  it('PB-02 reserva mayor al disponible', async () => {
    // Criterio: Devuelve false y el stock no cambia.
    const sku = `PB02-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 312, reservado: 0 });
    const primera = await conPg((c) => c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 40, 'PB-02', null]));
    expect(primera.rows[0].ok).toBe(true);
    const antes = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).single();
    expect(Number(antes.data!.disponible)).toBe(272);
    expect(Number(antes.data!.reservado)).toBe(40);
    const segunda = await conPg((c) => c.query('select reservar_stock($1,$2,$3,$4,$5) as ok', [productoId, semilla.bodegaId, 300, 'PB-02', null]));
    expect(segunda.rows[0].ok).toBe(false);
    const despues = await admin.from('stock').select('disponible, reservado').eq('producto_id', productoId).single();
    expect(Number(despues.data!.disponible)).toBe(272);
    expect(Number(despues.data!.reservado)).toBe(40);
  });

  it('PB-03 stock negativo bloqueado', async () => {
    // Criterio: Error por la restricción CHECK; no se guarda.
    const sku = `PB03-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    await admin.from('stock').insert({ producto_id: productoId, bodega_id: semilla.bodegaId, disponible: 5, reservado: 0 });
    await expect(conPg((c) => c.query('update stock set disponible = -1 where producto_id = $1', [productoId]))).rejects.toThrow(/check|disponible/i);
    const queda = await admin.from('stock').select('disponible').eq('producto_id', productoId).single();
    expect(Number(queda.data!.disponible)).toBe(5);
  });

  it('PB-04 transición de estado inválida', async () => {
    // Criterio: Excepción "Transición de pedido no permitida".
    const pedido = await admin.from('pedidos').insert({
      cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
    }).select('id, estado').single();
    if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
    expect(pedido.data.estado).toBe('creado');
    const paso = await admin.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedido.data.id).eq('estado', 'creado');
    if (paso.error) throw paso.error;
    const { error } = await admin.from('pedidos').update({ estado: 'creado' }).eq('id', pedido.data.id);
    expect(error).toBeTruthy();
    expect(error!.message).toContain('Transición de pedido no permitida');
    const queda = await admin.from('pedidos').select('estado').eq('id', pedido.data.id).single();
    expect(queda.data!.estado).toBe('en_preparacion');
  });

  it('PB-05 número de pedido secuencial', async () => {
    // Criterio: Se genera PED-000001 y los siguientes consecutivos.
    await conPg(async (c) => {
      await c.query("select setval('pedido_numero_seq', 1, false)");
      const a = await c.query(
        'insert into pedidos (cliente_id, bodega_id, creado_por) values ($1,$2,$3) returning numero',
        [semilla.clienteId, semilla.bodegaId, semilla.asesor.id],
      );
      const b = await c.query(
        'insert into pedidos (cliente_id, bodega_id, creado_por) values ($1,$2,$3) returning numero',
        [semilla.clienteId, semilla.bodegaId, semilla.asesor.id],
      );
      expect(a.rows[0].numero).toBe('PED-000001');
      expect(b.rows[0].numero).toBe('PED-000002');
      console.log('PB-05 evidencia: la secuencia local pedido_numero_seq quedó adelantada');
    });
  });

  it('PB-06 entrada suma al disponible', async () => {
    // Criterio: Se crea la fila de stock con 312 disponibles y un movimiento de entrada.
    const sku = `PB06-${Date.now()}`;
    const producto = await admin.from('productos').insert({ sku, nombre: sku, precio_unitario: 1, activo: true }).select('id').single();
    if (producto.error || !producto.data) throw producto.error ?? new Error('sin producto');
    const productoId = producto.data.id as string;
    const previo = await admin.from('stock').select('id').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId);
    expect(previo.data ?? []).toHaveLength(0);
    await conPg((c) => c.query('select registrar_entrada($1,$2,$3,$4,$5)', [productoId, semilla.bodegaId, 312, 'PB-06', null]));
    const queda = await admin.from('stock').select('disponible').eq('producto_id', productoId).eq('bodega_id', semilla.bodegaId).single();
    expect(Number(queda.data!.disponible)).toBe(312);
    const mov = await admin.from('movimientos_stock').select('tipo, cantidad').eq('producto_id', productoId).eq('referencia', 'PB-06');
    expect(mov.data).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'entrada', cantidad: 312 })]));
  });
});
```

- [x] **Step 3: Correr PB-01 a PB-06**

El cwd es `backend/`, porque `ConfigModule` lee `./.env` desde ahí. La API HTTP puede estar detenida: estos casos usan `pg` y la service role.

```bash
cd backend && npm run test:pb
```

Expected: PASS de PB-01, PB-02, PB-03, PB-04, PB-05 y PB-06. Si `createUser` falla por `auth`, el comando falla y lo que depende de usuarios queda Bloqueado con el mensaje de GoTrue. No se borra la FK.

- [x] **Step 4: Commit**

```bash
git add backend/test/helpers/semilla.ts backend/test/pb.e2e-spec.ts
git commit -m "Agrega la semilla local de usuarios, bodega y stock."
```

### Task 4: PA-02 en el spec existente

**Files:**
- Modify: `backend/src/modules/pedidos/pedidos.service.spec.ts`
- Test: `backend/src/modules/pedidos/pedidos.service.spec.ts`

**Interfaces:**
- Consumes: `PedidosService.crear`
- Produces: el mock de stock responde `disponible: 18` y el cuerpo del 409 trae `lineas_sin_stock`.

**Criterio PA-02:** 409 con lineas_sin_stock; no queda pedido ni stock reservado.

- [x] **Step 1: Ajustar el spec**

El mock de stock pasa a `disponible: 18`. El `rpc` sigue devolviendo `{ data: false, error: null }`, así que no hay reserva que liberar. El archivo queda así:

```typescript
import { ConflictException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

/** Prueba unitaria: si ninguna línea tiene stock, el pedido se rechaza con 409 y se elimina. */
describe('PedidosService.crear', () => {
  it('PA-02 responde 409 con lineas_sin_stock y no deja el pedido', async () => {
    const eliminado = jest.fn().mockResolvedValue({});
    const tabla: any = {
      productos: { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'p1', sku: 'FER-0012', nombre: 'Cemento', precio_unitario: 78 }] }) }) }) },
      pedidos: {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x', numero: 'PED-000001' } }) }) }),
        delete: () => ({ eq: eliminado }),
      },
      stock: { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { disponible: 18 } }) }) }) }) },
    };
    const db: any = { from: (t: string) => tabla[t], rpc: async () => ({ data: false, error: null }) };
    const locks: any = { conLocks: (_k: string[], fn: () => Promise<unknown>) => fn() };
    const config: any = { get: () => 12 };
    const cola: any = { add: jest.fn() };
    const servicio = new PedidosService({ db } as any, locks, config, cola);
    const dto = { cliente_id: 'c', bodega_id: 'b', politica_faltantes: 'rechazar', lineas: [{ producto_id: 'p1', cantidad: 60 }] } as any;
    const usuario = { id: 'u', nombre: 'A', rol: 'asesor_ventas', bodega_id: null } as const;

    await expect(servicio.crear(dto, usuario)).rejects.toBeInstanceOf(ConflictException);
    await expect(servicio.crear(dto, usuario)).rejects.toMatchObject({
      response: {
        statusCode: 409,
        lineas_sin_stock: [{ producto_id: 'p1', sku: 'FER-0012', solicitado: 60, disponible: 18 }],
      },
    });
    expect(eliminado).toHaveBeenCalled();
    expect(cola.add).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Correr el spec**

```bash
cd backend && npm test
```

Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add backend/src/modules/pedidos/pedidos.service.spec.ts
git commit -m "Ajusta PA-02 al criterio de 409 con lineas_sin_stock."
```

### Task 5: PA-10 ejecutable

**Files:**
- Create: `backend/src/modules/pedidos/cola-picking.ts`
- Modify: `backend/src/modules/pedidos/pedidos.service.ts` (solo el import de `COLA_PICKING`)
- Modify: `backend/src/modules/pedidos/pedidos.module.ts`
- Modify: `backend/test/stock.concurrency.e2e-spec.ts`
- Test: `backend/test/stock.concurrency.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertEntornoLocal`, `crearApp`, `sembrar`, `crearProducto`, `ponerStock`, `leerStock`
- Produces: `export const COLA_PICKING = 'picking'` desde `backend/src/modules/pedidos/cola-picking.ts`. `pedidos.module.ts` lo reexporta. El string sigue siendo `'picking'`.

**Criterio PA-10:** Exactamente 3 respuestas 201 y 2 respuestas 409 o 423.

Hay un ciclo de módulo, no es error de TypeScript. `COLA_PICKING` se lee en el decorador `InjectQueue` antes de que `pedidos.module.js` asigne `exports.COLA_PICKING`. El token queda `undefined` y Nest no puede inyectar `PedidosService` al levantar `AppModule`. El unitario no lo ve porque hace `new PedidosService(...)`. Este arreglo va antes de `test:e2e`. No cambia la lógica de stock ni los expects (3 con 201 y 2 con 409 o 423).

- [x] **Step 1: Sacar la cola a su propio archivo**

Crear `backend/src/modules/pedidos/cola-picking.ts`:

```typescript
export const COLA_PICKING = 'picking';
```

En `pedidos.service.ts`, cambia solo esta línea. No cambies la lógica de crear, compensar, listar, obtener ni cancelar.

```typescript
import { COLA_PICKING } from './cola-picking';
```

En `pedidos.module.ts`, borra el `export const COLA_PICKING = 'picking'` de ese archivo, importa desde `./cola-picking` y reexporta. `picking.module.ts` y `picking.processor.ts` pueden seguir importando desde `pedidos.module`.

```typescript
import { COLA_PICKING } from './cola-picking';

export { COLA_PICKING };
```

`BullModule.registerQueue({ name: COLA_PICKING })` se queda. El string sigue siendo `'picking'`.

- [x] **Step 2: Commit del ciclo**

```bash
git add backend/src/modules/pedidos/cola-picking.ts backend/src/modules/pedidos/pedidos.service.ts backend/src/modules/pedidos/pedidos.module.ts
git commit -m "Saca COLA_PICKING de pedidos.module para que Nest inyecte PedidosService."
```

- [x] **Step 3: Quitar el skip y reponer el stock**

Se quita el ternario `describe.skip`. `beforeAll` llama `assertEntornoLocal`, `sembrar` y `crearApp`. `beforeEach` crea o reutiliza un producto y `ponerStock(..., 100, 0)`. El cuerpo del `it` se conserva: cinco POST de cantidad 30, `creados === 3`, `rechazados === 2`. El token es `semilla.asesor.token`. Al final se lee el stock: `reservado` tiene que ser 90 y `disponible` 10. No se cambia el lock.

```typescript
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
```

- [x] **Step 4: Correr PA-10**

```bash
cd backend && npm run test:e2e -- --testPathPattern stock.concurrency
```

Expected: PASS con 3 y 2. Si los status no dan 3 y 2, el test queda rojo. En el resultado se copian los cinco status. Un skip no es Aprobado. No se cambia el lock. Si Nest no puede inyectar `PedidosService`, el ciclo de `COLA_PICKING` del paso 1 no quedó aplicado: no se tocan los expects.

- [x] **Step 5: Commit**

```bash
git add backend/test/stock.concurrency.e2e-spec.ts
git commit -m "Hace repetible la concurrencia de cinco pedidos sobre 100 unidades."
```

### Task 6: PA-01 pedido con stock suficiente

**Files:**
- Create: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertEntornoLocal()`, `crearApp()`, `sembrar(admin)`, `crearProducto(admin, sku, precio, bodegaId, disponible)`, `leerStock(admin, productoId, bodegaId)`
- Produces: el `describe` de `backend/test/pa-pedidos.e2e-spec.ts` con `app`, `admin` y `semilla`. Importar `semilla.ts` carga `globalThis.WebSocket` desde `ws` (Node v20.19.4).

**Criterio PA-01:** 201. Líneas reservadas; subtotal, IVA 12 % y total correctos; estado Creado.

Precios fijados: 78.00 y 20.00. Cantidades 40 y 25. Subtotal `40*78+25*20 = 3620`, IVA `434.40`, total `4054.40`. El estado que devuelve el código es `creado`. Comparar los numeric con `Number`.

- [ ] **Step 1: Escribir el e2e de PA-01**

```typescript
import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA pedidos', () => {
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

  it('PA-01 pedido con stock suficiente', async () => {
    const a = await crearProducto(admin, `PA01A-${Date.now()}`, 78, semilla.bodegaId, 100);
    const b = await crearProducto(admin, `PA01B-${Date.now()}`, 20, semilla.bodegaId, 100);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: a, cantidad: 40 }, { producto_id: b, cantidad: 25 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('creado');
    expect(res.body.lineas).toHaveLength(2);
    expect(res.body.lineas.every((l: { estado: string }) => l.estado === 'reservada')).toBe(true);
    expect(Number(res.body.subtotal)).toBe(3620);
    expect(Number(res.body.iva)).toBe(434.4);
    expect(Number(res.body.total)).toBe(4054.4);
  });
});
```

- [ ] **Step 2: Correr PA-01**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t PA-01
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Cubre el pedido con stock suficiente y el IVA del 12 por ciento."
```

### Task 7: PA-02 por HTTP

**Files:**
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `crearProducto`, `leerStock`, `semilla.asesor.token`, `semilla.clienteId`, `semilla.bodegaId`
- Produces: ninguna

**Criterio PA-02:** 409 con lineas_sin_stock; no queda pedido ni stock reservado.

- [ ] **Step 1: Agregar el it de PA-02**

Pégalo dentro del `describe` de `backend/test/pa-pedidos.e2e-spec.ts`. Agrega `leerStock` al import que ya trae `crearProducto` y `sembrar`.

```typescript
  it('PA-02 rechaza la línea sin stock', async () => {
    const productoId = await crearProducto(admin, `PA02-${Date.now()}`, 10, semilla.bodegaId, 18);
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'rechazar',
        lineas: [{ producto_id: productoId, cantidad: 60 }],
      });
    expect(res.status).toBe(409);
    expect(res.body.lineas_sin_stock[0]).toMatchObject({ solicitado: 60, disponible: 18 });
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 18, reservado: 0 });
    const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    expect(despues.count).toBe(antes.count);
  });
```

- [ ] **Step 2: Correr PA-02**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t PA-02
```

Expected: PASS, status 409.

- [ ] **Step 3: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Verifica por HTTP el rechazo cuando no hay stock."
```

### Task 8: PA-03 y PA-04

**Files:**
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `crearProducto`, `leerStock`, `semilla`
- Produces: ninguna

**Criterio PA-03:** 201. La línea sin stock queda en backorder y no suma al total.

**Criterio PA-04:** 409; no se crea el pedido.

Precios de PA-03: A 10×40 y B 10×25 entran al total (subtotal 650, IVA 78, total 728). C precio 99 con disponible 0 queda `backorder` y su stock no se mueve.

- [ ] **Step 1: Agregar los dos it**

```typescript
  it('PA-03 backorder parcial', async () => {
    const a = await crearProducto(admin, `PA03A-${Date.now()}`, 40, semilla.bodegaId, 100);
    const b = await crearProducto(admin, `PA03B-${Date.now()}`, 25, semilla.bodegaId, 100);
    const c = await crearProducto(admin, `PA03C-${Date.now()}`, 99, semilla.bodegaId, 0);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'backorder',
        lineas: [
          { producto_id: a, cantidad: 10 },
          { producto_id: b, cantidad: 10 },
          { producto_id: c, cantidad: 1 },
        ],
      });
    expect(res.status).toBe(201);
    const lineaC = res.body.lineas.find((l: { producto_id: string }) => l.producto_id === c);
    expect(lineaC.estado).toBe('backorder');
    expect(Number(res.body.subtotal)).toBe(650);
    expect(Number(res.body.iva)).toBe(78);
    expect(Number(res.body.total)).toBe(728);
    expect(await leerStock(admin, c, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
  });

  it('PA-04 ninguna línea con stock', async () => {
    const a = await crearProducto(admin, `PA04A-${Date.now()}`, 10, semilla.bodegaId, 0);
    const b = await crearProducto(admin, `PA04B-${Date.now()}`, 10, semilla.bodegaId, 0);
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        politica_faltantes: 'backorder',
        lineas: [{ producto_id: a, cantidad: 1 }, { producto_id: b, cantidad: 1 }],
      });
    expect(res.status).toBe(409);
    const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    expect(despues.count).toBe(antes.count);
    expect(await leerStock(admin, a, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
    expect(await leerStock(admin, b, semilla.bodegaId)).toMatchObject({ disponible: 0, reservado: 0 });
  });
```

- [ ] **Step 2: Correr PA-03 y PA-04**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t "PA-03|PA-04"
```

Expected: PASS. PA-03 responde 201. PA-04 responde 409.

- [ ] **Step 3: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Cubre backorder parcial y el rechazo cuando ninguna línea tiene stock."
```

### Task 9: PA-05 y PA-06

**Files:**
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Modify: `backend/src/modules/pedidos/pedidos.service.ts` solo si el primer POST de PA-06 no nombra el id
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `crearProducto`, `semilla`
- Produces: si PA-06 falla, el 400 pasa a `Hay productos inexistentes o inactivos: ${ids}`

**Criterio PA-05:** 400 de validación.

**Criterio PA-06:** 400 indicando el producto.

- [ ] **Step 1: Agregar los dos it**

```typescript
  it('PA-05 cantidad inválida', async () => {
    const productoId = await crearProducto(admin, `PA05-${Date.now()}`, 10, semilla.bodegaId, 10);
    for (const cantidad of [0, -1]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad }],
        });
      expect(res.status).toBe(400);
    }
  });

  it('PA-06 producto inexistente o inactivo', async () => {
    const ausente = '11111111-1111-4111-8111-111111111111';
    const inactivo = await crearProducto(admin, `PA06-${Date.now()}`, 10, semilla.bodegaId, 10);
    await admin.from('productos').update({ activo: false }).eq('id', inactivo);
    for (const productoId of [ausente, inactivo]) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 1 }],
        });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(productoId);
    }
  });
```

- [ ] **Step 2: Correr PA-05 y PA-06**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t "PA-05|PA-06"
```

Expected: PA-05 PASS con dos 400. PA-06 puede FAIL en el primer POST si el body no contiene el id. Guarda ese body. No marques Aprobado.

- [ ] **Step 3: Nombrar los ids solo si PA-06 falló**

Si el primer body no contiene el id, reemplaza en `pedidos.service.ts` esta línea:

```typescript
if ((productos?.length ?? 0) !== pedidas.size) throw new BadRequestException('Hay productos inexistentes o inactivos');
```

por esto y nada más:

```typescript
const ids = [...pedidas.keys()];
const encontrados = new Set((productos ?? []).map((p) => p.id));
const faltantes = ids.filter((id) => !encontrados.has(id));
if (faltantes.length) {
  throw new BadRequestException(`Hay productos inexistentes o inactivos: ${faltantes.join(', ')}`);
}
```

No cambies reserva, compensación ni totales. Vuelve a correr el comando del paso 2.

Expected del segundo intento: PASS. La evidencia guarda el body del primer intento y el del segundo.

- [ ] **Step 4: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts backend/src/modules/pedidos/pedidos.service.ts
git commit -m "Rechaza cantidad inválida y nombra el producto inexistente."
```

Si el servicio no cambió porque el mensaje ya contenía el id, no lo agregues al commit.

### Task 10: PA-07 lock ocupado

**Files:**
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `LockService.llaveStock(productoId, bodegaId)`, `crearProducto`, `leerStock`
- Produces: ninguna

**Criterio PA-07:** 423; no se modifica el stock.

La llave es `lock:stock:${bodegaId}:${productoId}`. Otro `Redlock` la toma 3000 ms con `retryCount: 0`. El POST de 10 unidades, con disponible 100, debe responder 423 y dejar disponible 100 y reservado 0. No subas `retryCount`, `retryDelay`, `retryJitter` ni `LOCK_TTL_MS`.

- [ ] **Step 1: Agregar el it**

Imports nuevos en el archivo: `import Redis from 'ioredis';`, `import Redlock from 'redlock';`, `import { LockService } from '../src/common/redis/lock.service';`.

```typescript
  it('PA-07 lock ocupado', async () => {
    const productoId = await crearProducto(admin, `PA07-${Date.now()}`, 10, semilla.bodegaId, 100);
    const redis = new Redis(process.env.REDIS_URL!);
    const redlock = new Redlock([redis], { retryCount: 0 });
    const lock = await redlock.acquire([LockService.llaveStock(productoId, semilla.bodegaId)], 3000);
    try {
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 10 }] });
      expect(res.status).toBe(423);
      expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 100, reservado: 0 });
    } finally {
      await lock.release();
      await redis.quit();
    }
  });
```

- [ ] **Step 2: Correr PA-07**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t PA-07
```

Expected: PASS, status 423, stock 100/0.

- [ ] **Step 3: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Comprueba el 423 cuando el lock del SKU sigue tomado."
```

### Task 11: PA-08 Redis no disponible

**Files:**
- Create: `backend/test/pa-08-redis.e2e-spec.ts`
- Modify: `backend/src/common/redis/lock.service.ts` solo si el POST se cuelga
- Test: `backend/test/pa-08-redis.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertEntornoLocal()`, `crearApp()`, `sembrar`, `crearProducto`, `leerStock`
- Produces: ninguna, salvo el cliente Redis del lock si el caso se cuelga

**Criterio PA-08:** Error controlado, sin reservas huérfanas.

`LockService` crea ioredis con `maxRetriesPerRequest: null`. Con Redis detenido, `acquire` puede quedarse esperando. Si a los 8 s no hay status, el caso Falló. La corrección, solo si eso se observa, es el cliente Redis del lock (no el de BullMQ): `maxRetriesPerRequest: 1`, `connectTimeout: 1000`, `enableOfflineQueue: false`. El `catch` actual convierte ese fallo en 423. No subas los reintentos del lock.

- [ ] **Step 1: Escribir el e2e aparte**

`backend/test/pa-08-redis.e2e-spec.ts`. `afterAll` hace `docker compose start redis`.

```typescript
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
```

- [ ] **Step 2: Correr PA-08**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-08-redis
```

Expected: PASS, status entre 400 y 499, stock 50/0. Si el timeout de supertest dispara, el caso Falló en ese intento. No lo marques Aprobado.

- [ ] **Step 3: Opciones del Redis del lock, solo si se colgó**

Si el paso 2 terminó por timeout, cambia solo el constructor de `this.redis` en `lock.service.ts`. Deja `retryCount: 5`, `retryDelay: 100`, `retryJitter: 50` y el TTL.

```typescript
this.redis = new Redis(config.getOrThrow<string>('redis.url'), {
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  enableOfflineQueue: false,
});
```

El `throw new HttpException(..., 423)` se queda. Vuelve a correr el comando del paso 2.

Expected del segundo intento: PASS, status 423, stock 50/0. `afterAll` deja Redis arriba (`ping` ok).

- [ ] **Step 4: Commit**

```bash
git add backend/test/pa-08-redis.e2e-spec.ts backend/src/common/redis/lock.service.ts
git commit -m "Exige un error controlado al crear un pedido sin Redis."
```

Si el servicio no cambió, no lo agregues.

### Task 12: PA-09 compensación

**Files:**
- Create: `backend/src/modules/pedidos/pedidos.compensacion.spec.ts`
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/src/modules/pedidos/pedidos.compensacion.spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `PedidosService.crear`, `crearProducto`, `leerStock`, `reservar_stock`, `liberar_stock`
- Produces: ninguna

**Criterio PA-09:** El stock reservado se libera y el pedido se elimina.

El trigger es solo de la prueba, creado y borrado en `finally`. No se agrega un flag al servicio.

- [ ] **Step 1: Escribir el spec unitario**

`backend/src/modules/pedidos/pedidos.compensacion.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';

describe('PedidosService compensación', () => {
  it('PA-09 libera la reserva si falla el guardado de las líneas', async () => {
    const eliminado = jest.fn().mockResolvedValue({});
    const liberados: { p_cantidad: number }[] = [];
    const tabla: any = {
      productos: { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'p1', sku: 'FER-0012', nombre: 'Cemento', precio_unitario: 10 }] }) }) }) },
      pedidos: {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x', numero: 'PED-000009' }, error: null }) }) }),
        delete: () => ({ eq: eliminado }),
      },
      pedido_lineas: { insert: async () => ({ error: { message: 'fallo' } }) },
    };
    const rpc = jest.fn(async (fn: string, args: { p_cantidad: number }) => {
      if (fn === 'reservar_stock') return { data: true, error: null };
      if (fn === 'liberar_stock') liberados.push(args);
      return { data: null, error: null };
    });
    const db: any = { from: (t: string) => tabla[t], rpc };
    const locks: any = { conLocks: (_k: string[], fn: () => Promise<unknown>) => fn() };
    const config: any = { get: () => 12 };
    const cola: any = { add: jest.fn() };
    const servicio = new PedidosService({ db } as any, locks, config, cola);

    await expect(servicio.crear(
      { cliente_id: 'c', bodega_id: 'b', lineas: [{ producto_id: 'p1', cantidad: 10 }] } as any,
      { id: 'u', nombre: 'A', rol: 'asesor_ventas', bodega_id: null },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(liberados[0].p_cantidad).toBe(10);
    expect(eliminado).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el unitario**

```bash
cd backend && npx jest src/modules/pedidos/pedidos.compensacion.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Agregar el e2e con trigger**

En `pa-pedidos.e2e-spec.ts`, importa `Client` desde `pg` y agrega este `it`. El `finally` siempre borra el trigger.

```typescript
  it('PA-09 compensación ante fallo al guardar líneas', async () => {
    const { Client } = await import('pg');
    const productoId = await crearProducto(admin, `PA09-${Date.now()}`, 10, semilla.bodegaId, 40);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    const antes = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
    try {
      await pg.query(`create or replace function public._prueba_fallar_lineas() returns trigger
        language plpgsql as $$ begin raise exception 'fallo forzado de prueba'; end $$`);
      await pg.query(`create trigger trg_prueba_fallar_lineas before insert on pedido_lineas
        for each row execute function public._prueba_fallar_lineas()`);
      const res = await request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 10 }],
        });
      expect(res.status).not.toBe(201);
      expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 40, reservado: 0 });
      const despues = await admin.from('pedidos').select('id', { count: 'exact', head: true }).eq('cliente_id', semilla.clienteId);
      expect(despues.count).toBe(antes.count);
    } finally {
      await pg.query('drop trigger if exists trg_prueba_fallar_lineas on pedido_lineas');
      await pg.query('drop function if exists public._prueba_fallar_lineas()');
      await pg.end();
    }
  });
```

- [ ] **Step 4: Correr el e2e**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t PA-09
```

Expected: PASS. El status no es 201. Stock 40/0. El conteo de pedidos no aumenta.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/pedidos/pedidos.compensacion.spec.ts backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Libera la reserva si falla el guardado de las líneas."
```

### Task 13: PA-11, PA-12 y PA-13

**Files:**
- Modify: `backend/test/pa-pedidos.e2e-spec.ts`
- Test: `backend/test/pa-pedidos.e2e-spec.ts`

**Interfaces:**
- Consumes: `crearProducto`, `ponerStock`, `leerStock`, `POST /api/v1/pedidos/:id/cancelar`
- Produces: ninguna

**Criterio PA-11:** Ambos se crean sin esperarse entre sí.

**Criterio PA-12:** Las 40 vuelven a Disponible; estado Cancelado; movimiento de liberación.

**Criterio PA-13:** 409; nada cambia.

El trigger no permite `creado → despachado`. La preparación, por SQL de la prueba: `creado → en_preparacion → despachado`. No hace falta implementar despachos para PA-13.

- [ ] **Step 1: Agregar los tres it**

```typescript
  it('PA-11 SKU distintos en paralelo', async () => {
    const a = await crearProducto(admin, `PA11A-${Date.now()}`, 10, semilla.bodegaId, 100);
    const b = await crearProducto(admin, `PA11B-${Date.now()}`, 10, semilla.bodegaId, 100);
    const t0 = Date.now();
    const marcas: number[] = [];
    const post = (productoId: string) => {
      marcas.push(Date.now());
      return request(app.getHttpServer())
        .post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({
          cliente_id: semilla.clienteId,
          bodega_id: semilla.bodegaId,
          lineas: [{ producto_id: productoId, cantidad: 10 }],
        });
    };
    const [ra, rb] = await Promise.all([post(a), post(b)]);
    console.log('PA-11 inicios', marcas, 'fin', Date.now(), 'desde', t0);
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
  });

  it('PA-12 cancelar pedido creado', async () => {
    const productoId = await crearProducto(admin, `PA12-${Date.now()}`, 10, semilla.bodegaId, 100);
    const creado = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 40 }],
      });
    expect(creado.status).toBe(201);
    const cancelado = await request(app.getHttpServer())
      .post(`/api/v1/pedidos/${creado.body.id}/cancelar`)
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({});
    expect(cancelado.body.estado).toBe('cancelado');
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 100, reservado: 0 });
    const mov = await admin.from('movimientos_stock').select('tipo, cantidad, referencia')
      .eq('referencia', creado.body.numero).eq('tipo', 'liberacion');
    expect(mov.data).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: 'liberacion', cantidad: 40 })]));
  });

  it('PA-13 cancelar pedido despachado', async () => {
    const { Client } = await import('pg');
    const productoId = await crearProducto(admin, `PA13-${Date.now()}`, 10, semilla.bodegaId, 100);
    const creado = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 10 }],
      });
    expect(creado.status).toBe(201);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    try {
      await pg.query(`update pedidos set estado = 'en_preparacion' where id = $1 and estado = 'creado'`, [creado.body.id]);
      await pg.query(`update pedidos set estado = 'despachado' where id = $1 and estado = 'en_preparacion'`, [creado.body.id]);
      const stockAntes = await leerStock(admin, productoId, semilla.bodegaId);
      const movAntes = await admin.from('movimientos_stock').select('id', { count: 'exact', head: true }).eq('referencia', creado.body.numero);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pedidos/${creado.body.id}/cancelar`)
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
        .send({});
      expect(res.status).toBe(409);
      const pedido = await admin.from('pedidos').select('estado').eq('id', creado.body.id).single();
      expect(pedido.data!.estado).toBe('despachado');
      expect(await leerStock(admin, productoId, semilla.bodegaId)).toEqual(stockAntes);
      const movDespues = await admin.from('movimientos_stock').select('id', { count: 'exact', head: true }).eq('referencia', creado.body.numero);
      expect(movDespues.count).toBe(movAntes.count);
    } finally {
      await pg.end();
    }
  });
```

- [ ] **Step 2: Correr los tres**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t "PA-11|PA-12|PA-13"
```

Expected: PASS. PA-11 dos status 201. PA-12 estado `cancelado`, stock 100/0, movimiento `liberacion` de 40. PA-13 status 409 y el estado sigue `despachado`.

- [ ] **Step 3: Commit**

```bash
git add backend/test/pa-pedidos.e2e-spec.ts
git commit -m "Cubre la carrera de dos SKU y la cancelación según el estado."
```

### Task 14: PA-14 picking idempotente

**Files:**
- Create: `backend/test/pa-picking.e2e-spec.ts`
- Modify: `backend/src/modules/picking/picking.processor.ts` solo si la primera llamada deja 0 tareas
- Test: `backend/test/pa-picking.e2e-spec.ts`

**Interfaces:**
- Consumes: `PickingProcessor.process(job)`, `assertEntornoLocal`, `crearApp`, `sembrar`, `crearProducto`, `ponerStock`
- Produces: ninguna, salvo el `process` idempotente si el upsert deja cero tareas

**Criterio PA-14:** Existe una sola tarea con una sola línea por producto.

- [ ] **Step 1: Escribir el test, sin cambiar el worker**

```typescript
import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job } from 'bullmq';
import { Client } from 'pg';
import { PickingProcessor } from '../src/modules/picking/picking.processor';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, ponerStock, sembrar, Semilla } from './helpers/semilla';

jest.setTimeout(30000);

describe('PA picking', () => {
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

  it('PA-14 procesar dos veces el mismo trabajo', async () => {
    const productoId = await crearProducto(admin, `PA14-${Date.now()}`, 10, semilla.bodegaId, 100);
    await ponerStock(admin, productoId, semilla.bodegaId, 60, 40);
    const pedido = await admin.from('pedidos').insert({
      cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
    }).select('id').single();
    if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
    const linea = await admin.from('pedido_lineas').insert({
      pedido_id: pedido.data.id, producto_id: productoId, cantidad: 40, precio_unitario: 10, estado: 'reservada',
    });
    if (linea.error) throw linea.error;
    const processor = app.get(PickingProcessor);
    await processor.process({ data: { pedido_id: pedido.data.id } } as Job<{ pedido_id: string }>);
    await processor.process({ data: { pedido_id: pedido.data.id } } as Job<{ pedido_id: string }>);
    const pg = new Client({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    try {
      const tareas = await pg.query('select count(*)::int as n from tareas_picking where pedido_id = $1', [pedido.data.id]);
      const lineas = await pg.query(`select count(*)::int as n from picking_lineas pl
        join tareas_picking t on t.id = pl.tarea_id where t.pedido_id = $1`, [pedido.data.id]);
      expect(tareas.rows[0].n).toBe(1);
      expect(lineas.rows[0].n).toBe(1);
    } finally {
      await pg.end();
    }
  });
});
```

- [ ] **Step 2: Correr PA-14**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-picking -t PA-14
```

Expected: PASS con una tarea y una línea. Si la primera llamada deja 0 tareas, el test queda rojo. Recién ahí se cambia `process`.

- [ ] **Step 3: Insert idempotente, solo si el conteo fue 0**

Reemplaza el cuerpo de `PickingProcessor.process` por: buscar por `pedido_id`; si existe, `return`; si no, `insert` y, si el error es `23505`, `return`; luego insertar `picking_lineas` solo en el camino del insert nuevo.

```typescript
async process(job: Job<{ pedido_id: string }>) {
  const db = this.supabase.db;
  const { pedido_id } = job.data;
  const ya = await db.from('tareas_picking').select('id').eq('pedido_id', pedido_id).maybeSingle();
  if (ya.error) throw ya.error;
  if (ya.data) return;
  const ins = await db.from('tareas_picking').insert({ pedido_id }).select('id').single();
  if (ins.error?.code === '23505') return;
  if (ins.error || !ins.data) throw ins.error ?? new Error('sin tarea');
  const { data: lineas } = await db
    .from('pedido_lineas').select('id').eq('pedido_id', pedido_id).eq('estado', 'reservada');
  await db.from('picking_lineas').insert((lineas ?? []).map((l) => ({ tarea_id: ins.data.id, pedido_linea_id: l.id })));
}
```

Vuelve a correr el comando del paso 2. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/test/pa-picking.e2e-spec.ts backend/src/modules/picking/picking.processor.ts
git commit -m "Comprueba que el worker de picking no duplica la tarea."
```

Si el processor no cambió, no lo agregues.

### Task 15: PA-15 entrada de mercancía

**Files:**
- Create: `backend/src/modules/inventario/inventario.dto.ts`
- Modify: `backend/src/modules/inventario/inventario.service.ts`
- Modify: `backend/src/modules/inventario/inventario.controller.ts`
- Create: `backend/test/pa-inventario.e2e-spec.ts`
- Test: `backend/test/pa-inventario.e2e-spec.ts`

**Interfaces:**
- Consumes: `crearProducto`, `leerStock`, `semilla.operario.token`, `semilla.proveedorId`
- Produces: `async registrarEntrada(dto: EntradaNuevaDto, usuario: UsuarioActual): Promise<{ id: string; codigo: string; estado: string; created_at: string }>`

**Criterio PA-15:** Disponible aumenta 200; movimiento de entrada con la referencia.

El test usa token de operario, disponible inicial 10 y una línea de 200. Esperar 201, `body.codigo`, stock disponible 210, movimiento `tipo === 'entrada'`, `cantidad === 200`, `referencia === body.codigo`.

- [ ] **Step 1: Escribir el test que falla**

`backend/test/pa-inventario.e2e-spec.ts` abre con el mismo `beforeAll` de `assertEntornoLocal`, `sembrar` y `crearApp` que `pa-pedidos.e2e-spec.ts` (importa `semilla.ts` para el `WebSocket`). El `it`:

```typescript
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
```

- [ ] **Step 2: Correr y ver el 501**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t PA-15
```

Expected: FAIL. Hoy `POST /inventario/entradas` responde 501.

- [ ] **Step 3: DTO y registrarEntrada**

`backend/src/modules/inventario/inventario.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaEntradaDto {
  @IsUUID() producto_id: string;
  @IsInt() @Min(1) cantidad: number;
}

export class EntradaNuevaDto {
  @IsUUID() proveedor_id: string;
  @IsUUID() bodega_id: string;
  @ValidateNested({ each: true }) @Type(() => LineaEntradaDto) @ArrayMinSize(1) lineas: LineaEntradaDto[];
}
```

En `inventario.service.ts`:

```typescript
async registrarEntrada(dto: EntradaNuevaDto, usuario: UsuarioActual) {
  const codigo = `OC-${Date.now()}`;
  const db = this.supabase.db;
  const { data: recepcion, error } = await db.from('recepciones').insert({
    codigo,
    proveedor_id: dto.proveedor_id,
    bodega_id: dto.bodega_id,
    estado: 'recibida',
    recibida_por: usuario.id,
    recibida_at: new Date().toISOString(),
  }).select('id, codigo, estado, created_at').single();
  if (error || !recepcion) throw new BadRequestException(error?.message ?? 'No se pudo crear la recepción');
  for (const linea of dto.lineas) {
    const ins = await db.from('recepcion_lineas').insert({
      recepcion_id: recepcion.id, producto_id: linea.producto_id, cantidad: linea.cantidad,
    });
    if (ins.error) throw new BadRequestException(ins.error.message);
    const rpc = await db.rpc('registrar_entrada', {
      p_producto: linea.producto_id, p_bodega: dto.bodega_id, p_cantidad: linea.cantidad,
      p_referencia: recepcion.codigo, p_usuario: usuario.id,
    });
    if (rpc.error) throw new BadRequestException(rpc.error.message);
  }
  return recepcion;
}
```

En el controller, el POST de entradas deja de lanzar 501:

```typescript
@Roles('operario_bodega')
@Post('entradas')
entrada(@Body() dto: EntradaNuevaDto, @CurrentUser() usuario: UsuarioActual) {
  return this.servicio.registrarEntrada(dto, usuario);
}
```

`ajuste()` sigue en 501.

- [ ] **Step 4: Volver a correr PA-15**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t PA-15
```

Expected: PASS, 201, disponible 210.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/inventario/inventario.dto.ts backend/src/modules/inventario/inventario.service.ts backend/src/modules/inventario/inventario.controller.ts backend/test/pa-inventario.e2e-spec.ts
git commit -m "Registra la entrada de mercancía con registrar_entrada."
```

### Task 16: PA-16 ajuste que dejaría stock negativo

**Files:**
- Modify: `backend/src/modules/inventario/inventario.dto.ts`
- Modify: `backend/src/modules/inventario/inventario.service.ts`
- Modify: `backend/src/modules/inventario/inventario.controller.ts`
- Modify: `backend/test/pa-inventario.e2e-spec.ts`
- Test: `backend/test/pa-inventario.e2e-spec.ts`

**Interfaces:**
- Consumes: `registrarEntrada` no se llama en este caso
- Produces: `async registrarAjuste(dto: AjusteNuevoDto, usuario: UsuarioActual): Promise<Movimiento>`. Un ajuste positivo sigue en 501.

**Criterio PA-16:** 409; el stock no cambia.

Body: `tipo: "ajuste"`, `cantidad: -500`, disponible sembrado en 312.

- [ ] **Step 1: Agregar el it y el de cantidad positiva**

```typescript
  it('PA-16 ajuste que deja stock negativo', async () => {
    const productoId = await crearProducto(admin, `PA16-${Date.now()}`, 10, semilla.bodegaId, 312);
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventario/ajustes')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({ producto_id: productoId, bodega_id: semilla.bodegaId, tipo: 'ajuste', cantidad: -500 });
    expect(res.status).toBe(409);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 312, reservado: 0, danado: 0 });
  });

  it('un ajuste positivo sigue en 501', async () => {
    const productoId = await crearProducto(admin, `PA16P-${Date.now()}`, 10, semilla.bodegaId, 312);
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventario/ajustes')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({ producto_id: productoId, bodega_id: semilla.bodegaId, tipo: 'ajuste', cantidad: 1 });
    expect(res.status).toBe(501);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 312, reservado: 0, danado: 0 });
  });
```

El segundo `it` no es un caso de la sección 3.4. Fija que el camino feliz del ajuste sigue sin implementarse.

- [ ] **Step 2: Correr y ver el fallo**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t "PA-16|ajuste positivo"
```

Expected: FAIL mientras `ajuste()` responde 501 también para la cantidad negativa. El caso de la sección 3.4 exige 409, no 501.

- [ ] **Step 3: Rechazar el negativo y dejar el positivo en 501**

Agrega a `inventario.dto.ts`:

```typescript
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class AjusteNuevoDto {
  @IsUUID() producto_id: string;
  @IsUUID() bodega_id: string;
  @IsIn(['ajuste', 'danio']) tipo: 'ajuste' | 'danio';
  @IsInt() cantidad: number;
  @IsOptional() @IsString() motivo?: string;
}
```

En el servicio:

```typescript
async registrarAjuste(dto: AjusteNuevoDto, usuario: UsuarioActual) {
  if (dto.tipo === 'danio') return this.registrarDanio(dto, usuario);
  const stock = await this.leerStockObligatorio(dto.producto_id, dto.bodega_id);
  if (dto.cantidad < 0 && stock.disponible + dto.cantidad < 0) {
    throw new ConflictException('El ajuste dejaría el stock negativo');
  }
  throw new NotImplementedException('Pendiente: Iteración 2');
}

private async leerStockObligatorio(productoId: string, bodegaId: string) {
  const { data, error } = await this.supabase.db.from('stock')
    .select('id, disponible, reservado, danado')
    .eq('producto_id', productoId).eq('bodega_id', bodegaId).maybeSingle();
  if (error) throw new BadRequestException(error.message);
  if (!data) throw new NotFoundException('No hay fila de stock');
  return data;
}
```

PA-16 no envía `danio`. Para que el archivo compile, deja este método y la Task 17 lo reemplaza:

```typescript
private async registrarDanio(_dto: AjusteNuevoDto, _usuario: UsuarioActual): Promise<never> {
  throw new NotImplementedException('Pendiente: Iteración 2');
}
```

El 409 del negativo sale antes de cualquier `update`.

El controller:

```typescript
@Roles('operario_bodega')
@Post('ajustes')
ajuste(@Body() dto: AjusteNuevoDto, @CurrentUser() usuario: UsuarioActual) {
  return this.servicio.registrarAjuste(dto, usuario);
}
```

- [ ] **Step 4: Volver a correr**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t "PA-16|ajuste positivo"
```

Expected: PASS. Cantidad −500 responde 409 y el stock sigue 312/0/0. Cantidad 1 responde 501.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/inventario/inventario.dto.ts backend/src/modules/inventario/inventario.service.ts backend/src/modules/inventario/inventario.controller.ts backend/test/pa-inventario.e2e-spec.ts
git commit -m "Rechaza el ajuste que dejaría el disponible en negativo."
```

### Task 17: PA-17 registrar daño

**Files:**
- Modify: `backend/src/modules/inventario/inventario.service.ts`
- Modify: `backend/test/pa-inventario.e2e-spec.ts`
- Test: `backend/test/pa-inventario.e2e-spec.ts`

**Interfaces:**
- Consumes: `registrarAjuste` delega en `registrarDanio` cuando `tipo === 'danio'`
- Produces: el movimiento `danio` con cantidad negativa. No hay función SQL nueva.

**Criterio PA-17:** Disponible baja 2 y Dañado sube 2.

- [ ] **Step 1: Agregar el it**

```typescript
  it('PA-17 registrar daño', async () => {
    const productoId = await crearProducto(admin, `PA17-${Date.now()}`, 10, semilla.bodegaId, 10);
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventario/ajustes')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({ producto_id: productoId, bodega_id: semilla.bodegaId, tipo: 'danio', cantidad: 2 });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('danio');
    expect(res.body.cantidad).toBe(-2);
    expect(await leerStock(admin, productoId, semilla.bodegaId)).toMatchObject({ disponible: 8, danado: 2 });
  });
```

- [ ] **Step 2: Correr y ver el fallo**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t PA-17
```

Expected: FAIL mientras `danio` no mueva el stock.

- [ ] **Step 3: registrarDanio**

```typescript
private async registrarDanio(dto: AjusteNuevoDto, usuario: UsuarioActual) {
  const unidades = Math.abs(dto.cantidad);
  if (unidades === 0) throw new BadRequestException('La cantidad de daño debe ser distinta de cero');
  const stock = await this.leerStockObligatorio(dto.producto_id, dto.bodega_id);
  if (stock.disponible < unidades) throw new ConflictException('No hay suficiente disponible para registrar el daño');
  const { data: actualizado, error } = await this.supabase.db.from('stock').update({
    disponible: stock.disponible - unidades,
    danado: stock.danado + unidades,
    updated_at: new Date().toISOString(),
  }).eq('id', stock.id).gte('disponible', unidades).select('disponible, danado').maybeSingle();
  if (error) throw new BadRequestException(error.message);
  if (!actualizado) throw new ConflictException('No hay suficiente disponible para registrar el daño');
  const mov = await this.supabase.db.from('movimientos_stock').insert({
    producto_id: dto.producto_id, bodega_id: dto.bodega_id, tipo: 'danio',
    cantidad: -unidades, referencia: dto.motivo ?? null, usuario_id: usuario.id,
  }).select('*').single();
  if (mov.error || !mov.data) throw new BadRequestException(mov.error?.message ?? 'No se pudo registrar el movimiento');
  return mov.data;
}
```

`registrarAjuste` ya delega con `if (dto.tipo === 'danio') return this.registrarDanio(dto, usuario)`. No agregues una función SQL.

- [ ] **Step 4: Volver a correr**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-inventario -t PA-17
```

Expected: PASS, 201, `tipo` `danio`, `cantidad` −2, disponible 8, dañado 2.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/inventario/inventario.service.ts backend/test/pa-inventario.e2e-spec.ts
git commit -m "Mueve a dañado las unidades del ajuste de tipo daño."
```

### Task 18: PA-18, PA-19 y PA-20

**Files:**
- Create: `backend/src/modules/picking/picking.dto.ts`
- Create: `backend/src/modules/picking/picking.service.ts`
- Modify: `backend/src/modules/picking/picking.controller.ts`
- Modify: `backend/src/modules/picking/picking.module.ts`
- Modify: `backend/test/pa-picking.e2e-spec.ts`
- Test: `backend/test/pa-picking.e2e-spec.ts`

**Interfaces:**
- Consumes: `PickingProcessor.process`
- Produces:
  - `async obtener(id: string): Promise<TareaPicking>`
  - `async escanear(id: string, dto: EscaneoNuevoDto): Promise<TareaPicking>`
  - `async completar(id: string, dto: CompletarPickingDto): Promise<TareaPicking>`

`GET /picking/tareas` (`listar`) sigue en 501.

**Criterio PA-18:** Rechazo con mensaje; nada se suma.

**Criterio PA-19:** Rechazo; lo recogido no pasa de 40.

**Criterio PA-20:** 409. Con faltante = true, la tarea queda con_faltante.

El pedido sigue en `en_preparacion`. El DTO acepta `nota` para que el pipe no responda 400 y no se persiste. El rol del token es `operario_bodega`. OpenAPI responde 200 en escaneo y completar: esos POST llevan `@HttpCode(200)`.

- [ ] **Step 1: Agregar los tres it**

Preparación compartida dentro de un `describe` anidado: pedido con una línea de 40, estado `en_preparacion`, `process` del worker una vez. SKU de la línea y otro SKU que no está en la tarea.

```typescript
  describe('escaneo y cierre', () => {
    let tareaId: string;
    let pedidoId: string;
    let skuLinea: string;
    const skuAjeno = `AJENO-${Date.now()}`;

    beforeAll(async () => {
      skuLinea = `PA18-${Date.now()}`;
      const productoId = await crearProducto(admin, skuLinea, 10, semilla.bodegaId, 100);
      const pedido = await admin.from('pedidos').insert({
        cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, creado_por: semilla.asesor.id,
      }).select('id').single();
      if (pedido.error || !pedido.data) throw pedido.error ?? new Error('sin pedido');
      pedidoId = pedido.data.id;
      await admin.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'creado');
      const linea = await admin.from('pedido_lineas').insert({
        pedido_id: pedidoId, producto_id: productoId, cantidad: 40, precio_unitario: 10, estado: 'reservada',
      });
      if (linea.error) throw linea.error;
      await app.get(PickingProcessor).process({ data: { pedido_id: pedidoId } } as Job<{ pedido_id: string }>);
      const tarea = await admin.from('tareas_picking').select('id').eq('pedido_id', pedidoId).single();
      if (tarea.error || !tarea.data) throw tarea.error ?? new Error('sin tarea');
      tareaId = tarea.data.id;
    });

    it('PA-18 escaneo de SKU ajeno', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/escaneos`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ sku: skuAjeno });
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).toContain(skuAjeno);
      const linea = await admin.from('picking_lineas').select('cantidad_recogida').eq('tarea_id', tareaId).single();
      expect(linea.data!.cantidad_recogida).toBe(0);
    });

    it('PA-19 escaneo que excede la cantidad', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/escaneos`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ sku: skuLinea, cantidad: 41 });
      expect(res.status).toBe(409);
      const linea = await admin.from('picking_lineas').select('cantidad_recogida').eq('tarea_id', tareaId).single();
      expect(linea.data!.cantidad_recogida).toBe(0);
    });

    it('PA-20 cerrar picking incompleto', async () => {
      const vacio = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/completar`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({});
      expect(vacio.status).toBe(409);
      const medio = await admin.from('tareas_picking').select('estado').eq('id', tareaId).single();
      expect(medio.data!.estado).not.toBe('completado');
      const conFaltante = await request(app.getHttpServer())
        .post(`/api/v1/picking/tareas/${tareaId}/completar`)
        .set('Authorization', `Bearer ${semilla.operario.token}`)
        .send({ faltante: true, nota: 'no se persiste' });
      expect(conFaltante.status).toBe(200);
      expect(conFaltante.body.estado).toBe('con_faltante');
      const pedido = await admin.from('pedidos').select('estado').eq('id', pedidoId).single();
      expect(pedido.data!.estado).toBe('en_preparacion');
    });
  });
```

- [ ] **Step 2: Correr y ver el 501**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-picking -t "PA-18|PA-19|PA-20"
```

Expected: FAIL. Escaneo y completar responden 501.

- [ ] **Step 3: Servicio, DTO y rutas**

`picking.dto.ts`:

```typescript
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EscaneoNuevoDto {
  @IsString() sku: string;
  @IsOptional() @IsInt() @Min(1) cantidad?: number;
}

export class CompletarPickingDto {
  @IsOptional() @IsBoolean() faltante?: boolean;
  @IsOptional() @IsString() nota?: string;
}
```

`picking.service.ts`. `obtener` selecciona la tarea, sus `picking_lineas`, la `cantidad` de `pedido_lineas` y `sku`/`nombre` de `productos`. Si no hay fila, `NotFoundException`.

```typescript
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CompletarPickingDto, EscaneoNuevoDto } from './picking.dto';

@Injectable()
export class PickingService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('tareas_picking')
      .select('id, pedido_id, estado, picking_lineas(pedido_linea_id, cantidad_recogida, pedido_lineas(cantidad, productos(sku, nombre)))')
      .eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Tarea no encontrada');
    const fila: any = data;
    return {
      id: fila.id,
      pedido_id: fila.pedido_id,
      estado: fila.estado,
      lineas: (fila.picking_lineas ?? []).map((l: any) => ({
        pedido_linea_id: l.pedido_linea_id,
        cantidad_recogida: l.cantidad_recogida,
        cantidad: l.pedido_lineas.cantidad,
        sku: l.pedido_lineas.productos.sku,
        nombre: l.pedido_lineas.productos.nombre,
      })),
    };
  }

  async escanear(id: string, dto: EscaneoNuevoDto) {
    const tarea = await this.obtener(id);
    const linea = tarea.lineas.find((l) => l.sku === dto.sku);
    if (!linea) throw new ConflictException(`El SKU ${dto.sku} no está en la tarea`);
    const suma = dto.cantidad ?? 1;
    if (linea.cantidad_recogida + suma > linea.cantidad) {
      throw new ConflictException('La cantidad recogida supera lo pedido');
    }
    const upd = await this.supabase.db.from('picking_lineas')
      .update({ cantidad_recogida: linea.cantidad_recogida + suma })
      .eq('pedido_linea_id', linea.pedido_linea_id);
    if (upd.error) throw new BadRequestException(upd.error.message);
    if (tarea.estado === 'pendiente') {
      await this.supabase.db.from('tareas_picking').update({ estado: 'en_curso' }).eq('id', id);
    }
    return this.obtener(id);
  }

  async completar(id: string, dto: CompletarPickingDto) {
    const tarea = await this.obtener(id);
    const incompletas = tarea.lineas.filter((l) => l.cantidad_recogida < l.cantidad);
    if (incompletas.length && !dto.faltante) throw new ConflictException('Hay líneas pendientes');
    const estado = incompletas.length ? 'con_faltante' : 'completado';
    const upd = await this.supabase.db.from('tareas_picking').update({
      estado, completada_at: new Date().toISOString(),
    }).eq('id', id);
    if (upd.error) throw new BadRequestException(upd.error.message);
    return this.obtener(id);
  }
}
```

`nota` no se escribe. En el controller, `listar()` sigue lanzando `NotImplementedException`. `obtener`, `escanear` y `completar` llaman al servicio. `escanear` y `completar` llevan `@HttpCode(200)`. El módulo registra `PickingService` en `providers`.

- [ ] **Step 4: Volver a correr**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-picking -t "PA-18|PA-19|PA-20"
```

Expected: PASS. PA-18 y PA-19 responden 409 y `cantidad_recogida` es 0. PA-20: `{}` responde 409 y el estado no es `completado`; `{ faltante: true }` responde 200 con `con_faltante`. El pedido sigue `en_preparacion`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/picking/picking.dto.ts backend/src/modules/picking/picking.service.ts backend/src/modules/picking/picking.controller.ts backend/src/modules/picking/picking.module.ts backend/test/pa-picking.e2e-spec.ts
git commit -m "Rechaza el escaneo ajeno o de más, y cierra con faltante."
```

### Task 19: Cliente de rutas y PA-22

**Files:**
- Create: `backend/src/modules/despachos/despachos.dto.ts`
- Create: `backend/src/modules/despachos/rutas.client.ts`
- Create: `backend/src/modules/despachos/despachos.service.ts`
- Modify: `backend/src/modules/despachos/despachos.controller.ts`
- Modify: `backend/src/modules/despachos/despachos.module.ts`
- Create: `backend/test/pa-despachos.e2e-spec.ts`
- Test: `backend/test/pa-despachos.e2e-spec.ts`

**Interfaces:**
- Consumes: `semilla.despachador.token`, `semilla.bodegaId`
- Produces:
  - `export interface RutaCruda { proveedor: 'osrm' | 'google'; distancia_km: number; duracion_min: number; ordenPuntos: number[]; segundosAcumulados: number[] }`
  - `async calcular(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null>`
  - `async calcularRuta(dto: RutaSolicitudDto): Promise<Ruta>`

`listar` e `iniciar` siguen en 501. `crear` y `entregar` llegan en la Task 21.

**Criterio PA-22:** Se usa Google Directions; si ambos fallan, 502.

- [x] **Step 1: Cliente real y calcularRuta**

`backend/src/modules/despachos/rutas.client.ts`. `calcular` llama primero a OSRM y, si devuelve null, a Google. No calcules Haversine ni etiquetes una distancia local como `osrm` o `google`.

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RutaCruda {
  proveedor: 'osrm' | 'google';
  distancia_km: number;
  duracion_min: number;
  ordenPuntos: number[];
  segundosAcumulados: number[];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class RutasClient {
  constructor(private readonly config: ConfigService) {}

  async calcular(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    return (await this.osrm(puntos)) ?? (await this.google(puntos));
  }

  private async osrm(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    const base = this.config.get<string>('rutas.osrmUrl') ?? 'http://127.0.0.1:5000';
    const coords = puntos.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${base}/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const body = await res.json();
      if (body.code !== 'Ok' || !body.trips?.[0]) return null;
      const trip = body.trips[0];
      const waypoints: { waypoint_index: number }[] = body.waypoints ?? [];
      const ordenPuntos = waypoints
        .map((w, i) => ({ i, waypoint_index: w.waypoint_index }))
        .filter((w) => w.i !== 0)
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map((w) => w.i);
      const segundosAcumulados: number[] = [];
      let acc = 0;
      for (const leg of trip.legs ?? []) {
        acc += leg.duration;
        segundosAcumulados.push(acc);
      }
      return {
        proveedor: 'osrm',
        distancia_km: round2(trip.distance / 1000),
        duracion_min: Math.round(trip.duration / 60),
        ordenPuntos,
        segundosAcumulados,
      };
    } catch {
      return null;
    }
  }

  private async google(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    const key = this.config.get<string>('rutas.googleKey') ?? '';
    const origin = puntos[0];
    const destination = puntos[puntos.length - 1];
    const medios = puntos.slice(1, -1);
    const waypoints = medios.length
      ? `&waypoints=${encodeURIComponent('optimize:true|' + medios.map((p) => `${p.lat},${p.lng}`).join('|'))}`
      : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypoints}&key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (body.status !== 'OK' || !body.routes?.[0]) return null;
      const route = body.routes[0];
      const ordenIntermedios: number[] = route.waypoint_order ?? [];
      const ordenPuntos = [...ordenIntermedios.map((i: number) => i + 1), puntos.length - 1].filter((i) => i !== 0);
      const segundosAcumulados: number[] = [];
      let acc = 0;
      let metros = 0;
      for (const leg of route.legs ?? []) {
        acc += leg.duration.value;
        metros += leg.distance.value;
        segundosAcumulados.push(acc);
      }
      return {
        proveedor: 'google',
        distancia_km: round2(metros / 1000),
        duracion_min: Math.round(acc / 60),
        ordenPuntos,
        segundosAcumulados,
      };
    } catch {
      return null;
    }
  }
}
```

```typescript
async calcularRuta(dto: RutaSolicitudDto) {
  const puntos = await this.puntosDe(dto);
  const cruda = await this.rutas.calcular(puntos.map((p) => ({ lng: p.lng, lat: p.lat })));
  if (!cruda) throw new BadGatewayException('El motor de rutas no respondió');
  const salida = dto.salida_prevista ? Date.parse(dto.salida_prevista) : Date.now();
  return {
    distancia_km: cruda.distancia_km,
    duracion_min: cruda.duracion_min,
    proveedor: cruda.proveedor,
    paradas: cruda.ordenPuntos.map((indicePunto, n) => ({
      orden: n + 1,
      pedido_id: puntos[indicePunto].pedidoId,
      cliente: puntos[indicePunto].cliente,
      direccion: puntos[indicePunto].direccion,
      eta: new Date(salida + cruda.segundosAcumulados[n] * 1000).toISOString(),
    })),
  };
}
```

`puntosDe` pone la bodega en el índice 0 y después cada pedido. Si a un cliente le falta latitud o longitud, `BadRequestException` con el `pedido_id`. El índice 0 no entra en `ordenPuntos`.

```typescript
private async puntosDe(dto: RutaSolicitudDto) {
  const db = this.supabase.db;
  const bodega = await db.from('bodegas').select('latitud, longitud, direccion, nombre').eq('id', dto.bodega_id).single();
  if (bodega.error || !bodega.data) throw new BadRequestException(bodega.error?.message ?? 'Bodega no encontrada');
  const pedidos = await db.from('pedidos').select('id, clientes(nombre, direccion, latitud, longitud)').in('id', dto.pedido_ids);
  if (pedidos.error) throw new BadRequestException(pedidos.error.message);
  const porId = new Map((pedidos.data ?? []).map((p: any) => [p.id, p]));
  const puntos: { lng: number; lat: number; pedidoId: string; cliente: string; direccion: string }[] = [{
    lng: Number(bodega.data.longitud), lat: Number(bodega.data.latitud),
    pedidoId: '', cliente: bodega.data.nombre, direccion: bodega.data.direccion ?? '',
  }];
  for (const id of dto.pedido_ids) {
    const p: any = porId.get(id);
    const c = p?.clientes;
    if (!p || c?.latitud == null || c?.longitud == null) {
      throw new BadRequestException(`Al cliente del pedido ${id} le falta latitud o longitud`);
    }
    puntos.push({ lng: Number(c.longitud), lat: Number(c.latitud), pedidoId: id, cliente: c.nombre, direccion: c.direccion ?? '' });
  }
  return puntos;
}
```

`RutaSolicitudDto`: `bodega_id` UUID, `pedido_ids` arreglo de UUID con al menos uno, `salida_prevista` opcional ISO. El controller conecta `POST calcular-ruta` con `@HttpCode(200)` y el token ya exigido por `@Roles('despachador')`. El módulo registra `DespachosService` y `RutasClient`.

- [x] **Step 2: Escribir PA-22**

Cuatro pedidos con coordenadas. La bodega de semilla está en `14.834700, -91.518100`. Cada pedido usa un cliente nuevo con esas coordenadas desplazadas `0.01 * (i + 1)` grados. Eso es dato, no una ruta calculada a mano. Antes de `crearApp`, `process.env.OSRM_URL = 'http://127.0.0.1:9'`. Se envuelve `global.fetch` y se guardan las URLs. Token del despachador.

```typescript
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
```

`cuatroIds` son los cuatro pedidos insertados con su cliente. Restaura `OSRM_URL` después de este `describe` para no contaminar PA-21.

- [x] **Step 3: Correr PA-22**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-despachos -t PA-22
```

Expected: PASS con 502, las dos URLs y sin `distancia_km`. Si el mensaje empieza por `BLOQUEADO:`, el caso queda Bloqueado y no se inventa la ruta.

- [x] **Step 4: Commit**

```bash
git add backend/src/modules/despachos backend/test/pa-despachos.e2e-spec.ts
git commit -m "Devuelve 502 cuando OSRM y Google no entregan una ruta."
```

### Task 20: PA-21 cálculo de ruta

**Files:**
- Modify: `backend/test/pa-despachos.e2e-spec.ts`
- Test: `backend/test/pa-despachos.e2e-spec.ts`

**Interfaces:**
- Consumes: `calcularRuta(dto)`, `OSRM_URL` del `.env` (`http://127.0.0.1:5000`)
- Produces: ninguna

**Criterio PA-21:** Orden de paradas, distancia, duración y ETA creciente.

Estado previsto: Bloqueado mientras calcular-ruta responda 502. No se escribe un servidor OSRM falso.

- [x] **Step 1: Agregar el it sin spy**

Este `describe` crea su app sin pisar `OSRM_URL`. Cuatro pedidos con el mismo desplazamiento de 0.01 grados.

```typescript
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
```

- [x] **Step 2: Correr PA-21**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-despachos -t PA-21
```

Expected: FAIL de Jest cuyo mensaje empieza por `BLOQUEADO:` si el status es 502. Eso se transcribe como Bloqueado, no como Falló ni Aprobado. Un 200 con ETA que no crece es Falló. No se inventa distancia.

- [x] **Step 3: Commit**

```bash
git add backend/test/pa-despachos.e2e-spec.ts
git commit -m "Registra el cálculo de ruta solo si un motor real responde."
```

### Task 21: PA-23 y PA-24

**Files:**
- Modify: `backend/src/modules/despachos/despachos.dto.ts`
- Modify: `backend/src/modules/despachos/despachos.service.ts`
- Modify: `backend/src/modules/despachos/despachos.controller.ts`
- Modify: `backend/test/pa-despachos.e2e-spec.ts`
- Test: `backend/test/pa-despachos.e2e-spec.ts`

**Interfaces:**
- Consumes: `semilla.vehiculoId`, `semilla.conductorId`, `semilla.asesor.token`, `semilla.despachador.token`
- Produces:
  - `async crear(dto: DespachoNuevoDto, usuario: UsuarioActual): Promise<Despacho>`
  - `async obtener(id: string): Promise<Despacho>`
  - `async entregar(despachoId: string, paradaId: string): Promise<Despacho>`

`listar` e `iniciar` siguen lanzando 501. `POST /despachos` responde 201. `entregar` lleva `@HttpCode(200)`.

**Criterio PA-23:** 409.

**Criterio PA-24:** Cada pedido pasa a Entregado y el despacho a Finalizado.

- [ ] **Step 1: crear, marcarDespachado y entregar**

El segundo tramo de `marcarDespachado` relee el estado: después de pasar `creado` a `en_preparacion`, `data.estado` sigue siendo el valor viejo. Usa `actual`.

```typescript
async crear(dto: DespachoNuevoDto, usuario: UsuarioActual) {
  const db = this.supabase.db;
  const ids = dto.paradas.map((p) => p.pedido_id);
  const ya = await db.from('despacho_paradas').select('pedido_id').in('pedido_id', ids);
  if (ya.error) throw new BadRequestException(ya.error.message);
  if ((ya.data ?? []).length) throw new ConflictException('El pedido ya está asignado a otra ruta');
  const codigo = `R-${Date.now().toString(36).toUpperCase()}`;
  const ins = await db.from('despachos').insert({
    codigo, vehiculo_id: dto.vehiculo_id, conductor_id: dto.conductor_id,
    bodega_id: dto.bodega_id, salida_prevista: dto.salida_prevista ?? null, creado_por: usuario.id,
  }).select('id').single();
  if (ins.error || !ins.data) throw new BadRequestException(ins.error?.message ?? 'No se pudo crear el despacho');
  for (const parada of dto.paradas) {
    await this.marcarDespachado(parada.pedido_id);
    const fila = await db.from('despacho_paradas').insert({
      despacho_id: ins.data.id, pedido_id: parada.pedido_id, orden: parada.orden, eta: parada.eta ?? null,
    });
    if (fila.error?.code === '23505') throw new ConflictException('El pedido ya está asignado a otra ruta');
    if (fila.error) throw new BadRequestException(fila.error.message);
  }
  return this.obtener(ins.data.id);
}

private async marcarDespachado(pedidoId: string) {
  const db = this.supabase.db;
  const { data, error } = await db.from('pedidos').select('estado').eq('id', pedidoId).single();
  if (error || !data) throw new NotFoundException('Pedido no encontrado');
  if (data.estado === 'creado') {
    const paso = await db.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'creado');
    if (paso.error) throw new ConflictException(paso.error.message);
  }
  const actual = data.estado === 'creado' ? 'en_preparacion' : data.estado;
  if (actual === 'en_preparacion') {
    const fin = await db.from('pedidos').update({ estado: 'despachado' }).eq('id', pedidoId).eq('estado', 'en_preparacion');
    if (fin.error) throw new ConflictException(fin.error.message);
  }
}

async entregar(despachoId: string, paradaId: string) {
  const despacho = await this.obtener(despachoId);
  const parada = (despacho.paradas ?? []).find((p) => p.id === paradaId);
  if (!parada) throw new NotFoundException('Parada no encontrada');
  if (parada.entregada_at) throw new ConflictException('Parada ya entregada');
  const ped = await this.supabase.db.from('pedidos').update({ estado: 'entregado' }).eq('id', parada.pedido_id).eq('estado', 'despachado');
  if (ped.error) throw new ConflictException(ped.error.message);
  const marca = await this.supabase.db.from('despacho_paradas').update({
    entregada_at: new Date().toISOString(),
  }).eq('id', paradaId);
  if (marca.error) throw new BadRequestException(marca.error.message);
  const pendientes = (despacho.paradas ?? []).filter((p) => p.id !== paradaId && !p.entregada_at);
  if (pendientes.length === 0) {
    await this.supabase.db.from('despachos').update({ estado: 'finalizado' }).eq('id', despachoId);
  }
  return this.obtener(despachoId);
}
```

`obtener` arma el `Despacho` de OpenAPI: `id`, `codigo`, `estado`, `vehiculo`, `conductor`, `distancia_km`, `duracion_min` y `paradas` con `id`, `orden`, `pedido_id`, `eta`, `entregada_at`. `DespachoNuevoDto` exige `vehiculo_id`, `conductor_id`, `bodega_id` y `paradas` con `pedido_id` y `orden`. El controller conecta `POST /`, `GET /:id` y `POST /:id/paradas/:paradaId/entregar`. `listar` e `iniciar` siguen en 501.

- [ ] **Step 2: Escribir PA-23 y PA-24**

PA-23: dos pedidos creados por el asesor. El despachador manda el primero y espera 201. El segundo POST, con el mismo `pedido_id` en `paradas`, espera 409. `select count(*) from despacho_paradas where pedido_id = $1` es 1.

PA-24: un despacho con dos pedidos en órdenes 1 y 2. Se entregan las dos paradas en orden. Tras la primera, ese pedido está `entregado` y el despacho no está `finalizado`. Tras la segunda, los dos pedidos están `entregado` y el despacho `finalizado`.

```typescript
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
```

- [ ] **Step 3: Correr PA-23 y PA-24**

```bash
cd backend && npx jest --config ./test/jest-e2e.json --testPathPattern pa-despachos -t "PA-23|PA-24"
```

Expected: PASS. PA-23 responde 409 y una sola parada. PA-24 deja los dos pedidos en `entregado` y el despacho en `finalizado`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/despachos backend/test/pa-despachos.e2e-spec.ts
git commit -m "Crea el despacho, impide la parada repetida y cierra la última entrega."
```

### Task 22: PS-01 a PS-06

**Files:**
- Create: `backend/test/ps.e2e-spec.ts`
- Test: `backend/test/ps.e2e-spec.ts`

**Interfaces:**
- Consumes: `assertEntornoLocal`, `crearApp`, `sembrar`, `crearProducto`, `registrarEntrada` ya expuesto por HTTP, `crear` de despachos ya expuesto por HTTP
- Produces: ninguna

**Criterio PS-01:** 401.

**Criterio PS-02:** 401.

**Criterio PS-03:** 403.

**Criterio PS-04:** 403.

**Criterio PS-05:** Devuelve 0 filas.

**Criterio PS-06:** Todas permitidas.

Reportes sigue en 501. Un 501 no es 403. Si el asesor recibe 501 en PS-04, el caso Falló. PS-06 queda Bloqueado si reportes devolvió 501, con los cuatro status en la evidencia.

- [ ] **Step 1: Escribir los seis it**

El archivo importa `semilla.ts`, que asigna `globalThis.WebSocket` desde `ws`, y llama `assertEntornoLocal`, `sembrar` y `crearApp`.

PS-01:

```typescript
  it('PS-01 sin token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/pedidos');
    expect(res.status).toBe(401);
  });
```

PS-02: se decodifica el payload del token del asesor, se cambia `sub` y se rearma el JWT sin volver a firmar.

```typescript
  it('PS-02 token alterado', async () => {
    const [h, p, s] = semilla.asesor.token.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.sub = '00000000-0000-0000-0000-000000000000';
    const nuevo = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${h}.${nuevo}.${s}`);
    expect(res.status).toBe(401);
  });
```

PS-03:

```typescript
  it('PS-03 operario sin permiso en pedidos', async () => {
    const productoId = await crearProducto(admin, `PS03-${Date.now()}`, 10, semilla.bodegaId, 10);
    const res = await request(app.getHttpServer())
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.operario.token}`)
      .send({
        cliente_id: semilla.clienteId,
        bodega_id: semilla.bodegaId,
        lineas: [{ producto_id: productoId, cantidad: 1 }],
      });
    expect(res.status).toBe(403);
  });
```

PS-04:

```typescript
  it('PS-04 asesor consulta reportes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/reportes/resumen')
      .set('Authorization', `Bearer ${semilla.asesor.token}`);
    console.log('PS-04 body', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(403);
  });
```

Si llega 501, el caso Falló. Guarda el body.

PS-05: el service role inserta un movimiento `entrada` de cantidad 1. El criterio es 0 filas, no un error.

```typescript
  it('PS-05 RLS con el JWT del asesor', async () => {
    const productoId = await crearProducto(admin, `PS05-${Date.now()}`, 10, semilla.bodegaId, 10);
    const ins = await admin.from('movimientos_stock').insert({
      producto_id: productoId, bodega_id: semilla.bodegaId, tipo: 'entrada', cantidad: 1, referencia: 'PS-05',
    });
    if (ins.error) throw ins.error;
    const usuario = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await usuario.auth.setSession({ access_token: semilla.asesor.token, refresh_token: semilla.asesor.refresh });
    const visto = await usuario.from('movimientos_stock').select('id');
    expect(visto.error).toBeNull();
    expect(visto.data).toEqual([]);
    const operario = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await operario.auth.setSession({ access_token: semilla.operario.token, refresh_token: semilla.operario.refresh });
    const vistoOp = await operario.from('movimientos_stock').select('id');
    expect(vistoOp.error).toBeNull();
    expect((vistoOp.data ?? []).length).toBeGreaterThanOrEqual(1);
  });
```

Si el asesor recibe error de permiso y no un arreglo vacío, anota el error, confirma que `db/grants_local.sql` se aplicó y repite. El criterio sigue siendo 0 filas.

PS-06: el admin hace un POST de pedido válido, un POST de entrada válido, un POST de despacho válido y `GET /reportes/resumen`. Se copian los cuatro status. Con 501 en reportes, la fila del caso es Bloqueado.

```typescript
  it('PS-06 administrador', async () => {
    const productoId = await crearProducto(admin, `PS06-${Date.now()}`, 10, semilla.bodegaId, 100);
    const pedido = await request(app.getHttpServer()).post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 1 }] });
    const entrada = await request(app.getHttpServer()).post('/api/v1/inventario/entradas')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({ proveedor_id: semilla.proveedorId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: productoId, cantidad: 1 }] });
    const otro = await crearProducto(admin, `PS06B-${Date.now()}`, 10, semilla.bodegaId, 10);
    const ped2 = await request(app.getHttpServer()).post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${semilla.asesor.token}`)
      .send({ cliente_id: semilla.clienteId, bodega_id: semilla.bodegaId, lineas: [{ producto_id: otro, cantidad: 1 }] });
    const despacho = await request(app.getHttpServer()).post('/api/v1/despachos')
      .set('Authorization', `Bearer ${semilla.admin.token}`)
      .send({
        vehiculo_id: semilla.vehiculoId, conductor_id: semilla.conductorId, bodega_id: semilla.bodegaId,
        paradas: [{ pedido_id: ped2.body.id, orden: 1 }],
      });
    const reporte = await request(app.getHttpServer()).get('/api/v1/reportes/resumen')
      .set('Authorization', `Bearer ${semilla.admin.token}`);
    const status = { pedido: pedido.status, entrada: entrada.status, despacho: despacho.status, reporte: reporte.status };
    console.log('PS-06', JSON.stringify(status));
    expect(pedido.status).toBe(201);
    expect(entrada.status).toBe(201);
    expect(despacho.status).toBe(201);
    if (reporte.status === 501) {
      throw new Error(`BLOQUEADO: reportes devolvió 501. ${JSON.stringify(status)}`);
    }
  });
```

- [ ] **Step 2: Correr la seguridad**

```bash
cd backend && npm run test:ps
```

Expected: PS-01 a PS-05 PASS (401, 401, 403, 403, 0 filas). PS-06 FAIL de Jest con mensaje que empieza por `BLOQUEADO:` si reportes devolvió 501. Esa fila es Bloqueado, con los cuatro status. Un 403 en las tres primeras no cumple “todas permitidas”.

- [ ] **Step 3: Commit**

```bash
git add backend/test/ps.e2e-spec.ts
git commit -m "Ejecuta los casos de token, rol y RLS con el JWT del usuario."
```

### Task 23: PR-02 contención sobre un SKU

**Files:**
- Create: `backend/test/pr02.e2e-spec.ts`
- Test: `backend/test/pr02.e2e-spec.ts`

**Interfaces:**
- Consumes: `ponerStock`, `leerStock`, `crearProducto`, `semilla.asesor.token`
- Produces: ninguna

**Criterio PR-02:** Exactamente 10 aceptadas; el resto 409 o 423; cero sobreventa.

Cada POST pide 1 y `disponible = 10`. No se edita `lock.service.ts` para acercar el número a 10. No se sube `retryCount`, `retryDelay`, `retryJitter` ni `LOCK_TTL_MS`.

- [x] **Step 1: Escribir el e2e**

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INestApplication } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import { assertEntornoLocal, crearApp } from './helpers/local';
import { crearProducto, leerStock, ponerStock, sembrar, Semilla } from './helpers/semilla';

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
    const respuestas = await Promise.all(Array.from({ length: 100 }, () =>
      request(app.getHttpServer()).post('/api/v1/pedidos')
        .set('Authorization', `Bearer ${semilla.asesor.token}`)
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
```

Si `aceptadas` no es 10, Jest falla. En el markdown se escriben `aceptadas`, `rechazadas`, los status distintos y el stock. Eso es Falló, no Aprobado parcial, aunque no haya sobreventa.

- [x] **Step 2: Correr PR-02**

```bash
cd backend && npm run test:pr02
```

Expected: el JSON de conteos sale en la consola. PASS solo si `aceptadas` es 10, `rechazadas` es 90 y `server` es 0. Si el “exactamente 10” no se cumple, el test queda rojo y el caso es Falló con esos números. No se edita el lock.

- [x] **Step 3: Commit**

```bash
git add backend/test/pr02.e2e-spec.ts
git commit -m "Mide cien reservas simultáneas contra stock para diez."
```

### Task 24: PR-01 carga con SKU distintos

**Files:**
- Create: `backend/test/pr01.mjs`
- Test: `backend/test/pr01.mjs`

**Interfaces:**
- Consumes: la semilla ya creada (cliente NIT `1234567-8`, bodega `Bodega Pruebas Local`, asesor `asesor.pruebas@logistock.local`, clave `ClavePruebas123`) y la API en `http://127.0.0.1:3000`
- Produces: ninguna

**Criterio PR-01:** Percentil 95 menor a 800 ms y cero errores 5xx.

50 bucles concurrentes, 60 segundos, un producto distinto por bucle, cantidad 1, stock 100000. 409 y 423 no son 5xx. Si el p95 sale ≥ 800, el caso Falló con el número medido. El umbral no se mueve. Node v20.19.4 no trae `WebSocket` global: el script asigna `ws` igual que `semilla.ts`.

- [x] **Step 1: Escribir el script**

```javascript
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
```

- [x] **Step 2: Levantar la API y correr un minuto**

```bash
cd backend && npm run start
```

En otra terminal, con cwd `backend`, primero:

```bash
curl -s http://127.0.0.1:3000/api/v1/health
```

Expected: `base_datos` es `ok` y `redis` es `ok`. Luego:

```bash
node test/pr01.mjs
```

Expected: un JSON `{ solicitudes, p95_ms, errores5xx }`. Exit 0 solo si `p95_ms < 800` y `errores5xx === 0`. Si no, exit 1 y el caso es Falló con el número medido. Ese JSON es la evidencia. Detén `npm run start` al terminar.

- [x] **Step 3: Commit**

```bash
git add backend/test/pr01.mjs
git commit -m "Agrega la carga de un minuto con cincuenta SKU distintos."
```

### Task 25: Resultados reales de los 42 casos

**Files:**
- Create: `docs/resultados_pruebas.md`

**Interfaces:**
- Consumes: la salida ya obtenida de cada comando de T3 a T24
- Produces: el markdown de resultados. No inventa cifras.

Se escribe después de T6–T24, copiando salidas. Cada fila sale del comando de su tarea. Una fila sin comando queda Bloqueado o No ejecutable, con la razón, y la columna de resultado dice que no se ejecutó.

PB-01 a PB-06 ya pasaron. La evidencia de PostgreSQL cita la versión que devolvió `select version()`: PostgreSQL 17.11, no 16. PA-10 ya pasó con status reales `201, 201, 409, 409, 201` y stock disponible 10, reservado 90. Esos dos bloques se copian de esa corrida. No se vuelven a marcar con otro criterio.

PU-01 a PU-04 entran ya como `No ejecutable`. La evidencia es: no hay aplicación de interfaz en `logistock/`.

**Criterio PU-01:** Aparece el aviso con las opciones Ajustar, Ver sustitutos y Backorder.

**Criterio PU-02:** El botón Confirmar pedido permanece deshabilitado.

**Criterio PU-03:** Solo se ven los módulos permitidos para ese rol.

**Criterio PU-04:** Sin desplazamiento horizontal de la página; botones de al menos 44 px.

PA-21 entra como Bloqueado si el throw fue el de 502, y se pega ese mensaje. PS-06 entra como Bloqueado si reportes devolvió 501, pegando los cuatro status. PR-02, si falló el `toBe(10)`, entra como Falló con los conteos, no como Aprobado parcial. PA-08, si hizo falta el segundo intento, guarda el timeout y el status del reintento. PA-06 guarda el body del primer intento y el del segundo.

- [x] **Step 1: Escribir el archivo con las 42 filas**

`docs/resultados_pruebas.md`. Rellena Estado, Resultado observado y Evidencia desde la salida del comando. No dejes celdas vacías: si no hubo comando, escribe Bloqueado o No ejecutable y “no se ejecutó”.

```markdown
# Resultados de las pruebas de la sección 3.4

Fecha de la corrida:
PostgreSQL (`select version()`): PostgreSQL 17.11
Supabase URL (tiene que ser 127.0.0.1 o localhost):
Redis:
Commit:

| ID | Estado | Resultado observado | Evidencia |
|---|---|---|---|
| PB-01 | Aprobado | 3 true, 2 false, disponible 10, reservado 90 | `npm run test:pb` |
| PB-02 | Aprobado | false y el stock no cambió (272/40) | `npm run test:pb` |
| PB-03 | Aprobado | error CHECK, el -1 no se guardó | `npm run test:pb` |
| PB-04 | Aprobado | el mensaje contiene "Transición de pedido no permitida" | `npm run test:pb` |
| PB-05 | Aprobado | PED-000001 y PED-000002. La secuencia local quedó adelantada. Antes de setval se borraron esos números si ya existían en la base local. | `npm run test:pb` |
| PB-06 | Aprobado | fila con 312 disponibles y movimiento de entrada | `npm run test:pb` |
| PA-01 | | | `npx jest --config ./test/jest-e2e.json --testPathPattern pa-pedidos -t PA-01` |
| PA-02 | | | unitario y `pa-pedidos -t PA-02` |
| PA-03 | | | `pa-pedidos -t PA-03` |
| PA-04 | | | `pa-pedidos -t PA-04` |
| PA-05 | | | `pa-pedidos -t PA-05` |
| PA-06 | | | body del primer intento y del segundo |
| PA-07 | | | `pa-pedidos -t PA-07` |
| PA-08 | | | `pa-08-redis` |
| PA-09 | | | spec de compensación y `pa-pedidos -t PA-09` |
| PA-10 | Aprobado | status 201, 201, 409, 409, 201; disponible 10; reservado 90 | `npm run test:e2e -- --testPathPattern stock.concurrency` |
| PA-11 | | | inicios y fin del Promise.all |
| PA-12 | | | estado cancelado, stock 100/0, liberación 40 |
| PA-13 | | | 409 y estado despachado |
| PA-14 | | | conteos 1 y 1 |
| PA-15 | | | 201, disponible 210, referencia |
| PA-16 | | | 409 y stock 312/0/0 |
| PA-17 | | | 201, disponible 8, dañado 2 |
| PA-18 | | | 409 y cantidad_recogida 0 |
| PA-19 | | | 409 y cantidad_recogida 0 |
| PA-20 | | | 409 y luego 200 con_faltante |
| PA-21 | | | 200 con ETA creciente, o el mensaje BLOQUEADO del 502 |
| PA-22 | | | 502 y las dos URLs, o BLOQUEADO si Google no se intentó |
| PA-23 | | | 409 y una parada |
| PA-24 | | | dos pedidos entregado y despacho finalizado |
| PS-01 | | | 401 |
| PS-02 | | | 401 |
| PS-03 | | | 403 |
| PS-04 | | | 403, o Falló si el body fue 501 |
| PS-05 | | | 0 filas del asesor y al menos 1 del operario |
| PS-06 | | | los cuatro status; Bloqueado si reportes fue 501 |
| PR-01 | | | JSON de solicitudes, p95_ms y errores5xx |
| PR-02 | | | aceptadas, rechazadas, status distintos y stock |
| PU-01 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-02 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-03 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-04 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |

## Totales

| Estado | Cantidad |
|---|---|
| Aprobado | |
| Falló | |
| Bloqueado | |
| No ejecutable | |
| Total | 42 |

## Cambios de código

Lista tomada de `git log` de esta corrida: archivo, qué cambió y qué caso lo obligó.
```

Los totales salen de contar las 42 filas después de pegar las salidas. No adelantes un Aprobado de PA-01 a PA-09, PA-11 a PA-24, PS ni PR: esas celdas se llenan con el status que imprimió el comando.

- [x] **Step 2: Commit**

```bash
git add docs/resultados_pruebas.md
git commit -m "Documenta los resultados reales de los 42 casos."
```

