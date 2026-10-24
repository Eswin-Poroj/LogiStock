# LogiStock

Sistema de inventario, logística y despacho desarrollado en el curso Análisis de Sistemas II (UMG).

Repositorio: [https://github.com/Eswin-Poroj/LogiStock.git](https://github.com/Eswin-Poroj/LogiStock.git)

## Estructura

| Ruta | Stack |
|------|--------|
| `logistock/backend` | API NestJS (`logistock-api`) |
| `logistock/frontend` | Interfaz Vite + React + TypeScript |

Usa **Node 20.x** (el entorno de referencia del proyecto es **v20.19.4**). El frontend declara `"node": "20.x"` en `engines`.

Contrato HTTP en `logistock/docs/openapi.yaml`. La API expone el prefijo global `api/v1` y, en local, escucha el puerto definido en `PORT` (por defecto **3000**).

## Requisitos locales

1. **Redis** (colas BullMQ): desde `logistock/backend`, con Docker:

   ```bash
   cd logistock/backend
   docker compose up -d
   ```

   El compose publica Redis en `127.0.0.1:6379`, alineado con `REDIS_URL` en `.env.example`.

2. **Postgres / Supabase local** (solo si vas a usar la base como en desarrollo): valores de referencia en `logistock/backend/.env.example`:

   - API Supabase: `http://127.0.0.1:54321`
   - Base de datos: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

   Aplica el esquema y luego las migraciones de `logistock/db/migraciones/` en orden (ajuste de stock, salida del reservado al despachar, cotizaciones, SKU automático, descuentos autorizados, ajustes por aprobar, peso de productos y avisos):

   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f logistock/db/migraciones/001_funcionalidades_completas.sql -f logistock/db/migraciones/002_sku_automatico.sql -f logistock/db/migraciones/003_reglas_pendientes_rup.sql -f logistock/db/migraciones/004_direccion_proveedor.sql -f logistock/db/grants_local.sql
   ```

   Copia `logistock/backend/.env.example` a `logistock/backend/.env` y completa `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` con lo que devuelva `supabase status` (no subas ese archivo a git).

3. **API NestJS**:

   ```bash
   cd logistock/backend
   npm install
   npm run start:dev
   ```

   Documentación interactiva: `http://127.0.0.1:3000/docs`.

4. **Frontend**:

   ```bash
   cd logistock/frontend
   npm install
   npm run dev
   ```

   La app queda en `http://127.0.0.1:5173`. La base del cliente HTTP es **`http://127.0.0.1:3000/api/v1`** (valor por defecto; opcionalmente fíjala con `VITE_API_BASE` copiando `logistock/frontend/.env.example` a `.env`).

Detalle de pruebas de interfaz y reglas del frontend: `logistock/frontend/README.md`.

## Pruebas

**Backend** (`logistock/backend`):

- `npm test` — pruebas unitarias (Jest).
- `npm run test:e2e` — pruebas e2e (Jest, `test/jest-e2e.json`).
- `npm run test:pb`, `npm run test:pa`, `npm run test:ps`, `npm run test:pr02` — subsets e2e por patrón.
- `npm run test:pr01` — script `test/pr01.mjs`.

**Frontend** (`logistock/frontend`):

- `npm test` — Vitest en modo run (`vitest run`).

Las pruebas de interfaz **PU-01 a PU-04** no se consideran aprobadas desde este README; no marques esas filas como aprobadas en `logistock/docs/resultados_pruebas.md` sin evidencia de ejecución (ver `logistock/frontend/README.md`).

## Qué no va al repositorio

Según el `.gitignore` de la raíz:

- Archivos de entorno: `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local` (incluidos los de backend y frontend).
- Metadatos locales: `.DS_Store`, `.idea`, `.vscode`, `.cursor/`.
- Carpetas de apoyo local: `superpowers/`, `./superpowers/`, `logistock/supabase/`.

## Comportamiento conocido (sin maquillar)

La interfaz muestra los códigos HTTP que devuelve la API; no inventa stock, rutas ni reportes. Ningún endpoint responde 501: todo el alcance v1 del RUP está habilitado.

- **`POST /pedidos` responde 423** si Redis no está arriba (no se obtiene el lock de CU-02). Levántalo con `docker compose up -d` en `logistock/backend`.
- **`POST /despachos/calcular-ruta` responde 502** si OSRM y Google Directions no entregan ruta. En macOS el puerto 5000 es del receptor AirPlay; por eso `.env.example` usa el servidor público `https://router.project-osrm.org`.
- **Despacho (CU-06):** solo acepta pedidos en preparación con el picking completado (409 si no) y descuenta el reservado del inventario al asignar.
- **Entregas (CU-07):** primero se inicia la ruta (`POST /despachos/{id}/iniciar`); confirmar una parada de una ruta no iniciada responde 409.
- **Recuperar contraseña (CU-11 A1):** en local el correo llega a Inbucket/Mailpit en `http://127.0.0.1:54324`.
- **Descuentos (CU-01 A2):** hasta `DESCUENTO_MAX_PCT` (10 %) los aplica el asesor; por encima, un administrador los autoriza con su correo y contraseña y queda registrado quién lo hizo.
- **Ajustes grandes (CU-04 A1):** si un operario ajusta más de `AJUSTE_MAX_PCT` (20 %) del disponible, el ajuste queda pendiente en Inventario › Aprobaciones hasta que un administrador lo apruebe o rechace.
- **Capacidad del vehículo (CU-06 A2):** con el peso por unidad de cada producto se compara la carga con el vehículo; si excede se sugiere dividir en viajes y solo se asigna confirmando la sobrecarga.
- **Faltante en picking (CU-05 E2):** el asesor que creó el pedido recibe un aviso (campana del menú) para ofrecer sustituto o backorder.
- **Pruebas e2e:** escriben en la base local, pero ya no borran pedidos existentes; solo los que crean.

