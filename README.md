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

La interfaz muestra los códigos HTTP que devuelve la API; no inventa stock, rutas ni reportes.

- **`POST /despachos/calcular-ruta`**: si OSRM y Google Directions no entregan ruta, responde **502** (`El motor de rutas no respondió`). La pantalla de despacho no rellena distancia, duración ni ETA en ese caso.
- **501 (Not Implemented)**, con mensajes del backend:
  - Reportes: `GET /reportes/resumen`, `GET /reportes/mas-vendidos`, `GET /reportes/alertas-stock`.
  - Picking: listado de tareas (`GET /picking/tareas`).
  - Despachos: listado (`GET /despachos`) e iniciar despacho (`POST /despachos/:id/iniciar`).
  - Inventario: ajuste con `tipo: 'ajuste'` sigue en **501** (`Pendiente: Iteración 2`) salvo los casos que el backend ya implementa (por ejemplo `tipo: 'danio'`, o ajuste negativo que el servicio rechaza con **409** si dejaría stock negativo).
