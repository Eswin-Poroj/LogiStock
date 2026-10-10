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

- [ ] **Step 1: Instalar y compilar**

Desde `logistock/`:

```bash
cd backend && npm install && npm run build
```

Expected: FAIL. `tsc` y Jest fallan solo en `src/common/redis/lock.service.ts`: `HttpStatus.LOCKED` no existe en NestJS 10 (el enum salta de 422 a 424). No es `let lock` ni TS7034.

- [ ] **Step 2: Escribir el 423 literal**

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

- [ ] **Step 3: Volver a compilar**

```bash
cd backend && npm run build
```

Expected: el comando termina sin errores. Equivale a `npx tsc --noEmit -p tsconfig.build.json` sin errores.

Si el plugin de Swagger en `nest-cli.json` rompe el build, `compilerOptions.plugins` pasa a:

```json
[{ "name": "@nestjs/swagger" }]
```

y se vuelve a correr el mismo comando. Expected: sin errores.

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Levantar Supabase local y anotar la versión**

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

- [ ] **Step 2: Escribir grants, el ejemplo y el .env de la corrida**

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

- [ ] **Step 3: Aplicar schema, grants y Redis**

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f db/grants_local.sql
cd backend && docker compose up -d
docker compose ps
```

Expected: `schema.sql` y `grants_local.sql` terminan sin error. `docker compose ps` muestra `redis` en marcha. Si el 6379 está ocupado por otro Redis, no se reutiliza: se libera el puerto o se cambia a la vez el puerto del compose y `REDIS_URL`.

- [ ] **Step 4: Escribir el freno local**

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

- [ ] **Step 5: Comprobar el host e instalar pg**

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

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Escribir la semilla**

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

- [ ] **Step 2: Escribir PB-01 a PB-06**

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

- [ ] **Step 3: Correr PB-01 a PB-06**

El cwd es `backend/`, porque `ConfigModule` lee `./.env` desde ahí. La API HTTP puede estar detenida: estos casos usan `pg` y la service role.

```bash
cd backend && npm run test:pb
```

Expected: PASS de PB-01, PB-02, PB-03, PB-04, PB-05 y PB-06. Si `createUser` falla por `auth`, el comando falla y lo que depende de usuarios queda Bloqueado con el mensaje de GoTrue. No se borra la FK.

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Ajustar el spec**

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

- [ ] **Step 2: Correr el spec**

```bash
cd backend && npm test
```

Expected: PASS.

- [ ] **Step 3: Commit**

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

- [ ] **Step 1: Sacar la cola a su propio archivo**

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

- [ ] **Step 2: Commit del ciclo**

```bash
git add backend/src/modules/pedidos/cola-picking.ts backend/src/modules/pedidos/pedidos.service.ts backend/src/modules/pedidos/pedidos.module.ts
git commit -m "Saca COLA_PICKING de pedidos.module para que Nest inyecte PedidosService."
```

- [ ] **Step 3: Quitar el skip y reponer el stock**

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

- [ ] **Step 4: Correr PA-10**

```bash
cd backend && npm run test:e2e -- --testPathPattern stock.concurrency
```

Expected: PASS con 3 y 2. Si los status no dan 3 y 2, el test queda rojo. En el resultado se copian los cinco status. Un skip no es Aprobado. No se cambia el lock. Si Nest no puede inyectar `PedidosService`, el ciclo de `COLA_PICKING` del paso 1 no quedó aplicado: no se tocan los expects.

- [ ] **Step 5: Commit**

```bash
git add backend/test/stock.concurrency.e2e-spec.ts
git commit -m "Hace repetible la concurrencia de cinco pedidos sobre 100 unidades."
```

<!-- CONTINUA -->
