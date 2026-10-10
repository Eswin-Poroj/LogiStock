# LogiStock API (esqueleto NestJS)

Backend del proyecto LogiStock · Análisis de Sistemas II · UMG Quetzaltenango.

## Puesta en marcha

1. Crear un proyecto en Supabase y ejecutar `../db/schema.sql` en el SQL Editor.
2. Copiar `.env.example` a `.env` y completar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
3. `docker compose up -d` (Redis) · `npm install` · `npm run start:dev`.
4. Swagger UI en http://localhost:3000/docs · contrato fuente en `../docs/openapi.yaml`.

## Estado por módulo

| Módulo | Estado |
|---|---|
| Auth (login, /me, guard con roles) | Hecho |
| Catálogos (clientes, productos, bodegas, vehículos, conductores) | Hecho (lectura y alta básica) |
| Inventario (listar, movimientos) | Hecho · entradas y ajustes: Iteración 1 y 2 |
| Pedidos (crear con lock + reserva atómica, listar, detalle, cancelar) | Hecho (núcleo, riesgo R1) |
| Picking (worker BullMQ que crea la tarea) | Worker hecho · endpoints: Iteración 3 |
| Despachos y rutas (OSRM) | Pendiente: Iteración 3 |
| Reportes | Pendiente: Transición |

## Pruebas

- `npm test`: unitarias (reserva sin stock → 409).
- `npm run test:e2e`: concurrencia de R1 (5 pedidos simultáneos de 30 u. sobre 100 u.: 3 ganan, 2 fallan). Ver variables `E2E_*` en el archivo.

## Estructura

```
src/
  common/ supabase/  redis/ (Redlock)  auth/ (guard, roles)
  modules/ auth  health  catalogos  inventario  pedidos  picking  despachos  reportes
```
