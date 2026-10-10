# Resultados de las pruebas de la sección 3.4

Fecha de la corrida: 2026-10-10  
PostgreSQL (`select version()`): PostgreSQL 17.11  
Supabase URL (tiene que ser 127.0.0.1 o localhost): `http://127.0.0.1:54321`  
Redis: `redis:7-alpine` en `127.0.0.1:6379` (contenedor `backend-redis-1`)  
Commit: `a0a1d59b0d9c55cf5e6cee30da0936bc77346466`

| ID | Estado | Resultado observado | Evidencia |
|---|---|---|---|
| PB-01 | Aprobado | 3 true, 2 false, disponible 10, reservado 90 | `task-3-report.md`: `npm run test:pb` exit 0, Node v20.19.4 |
| PB-02 | Aprobado | false y el stock no cambió (272/40) | `task-3-report.md`: `npm run test:pb` |
| PB-03 | Aprobado | error CHECK, el -1 no se guardó | `task-3-report.md`: `npm run test:pb` |
| PB-04 | Aprobado | el mensaje contiene "Transición de pedido no permitida" | `task-3-report.md`: `npm run test:pb` |
| PB-05 | Aprobado | PED-000001 y PED-000002. La secuencia local quedó adelantada. Antes de setval se borraron esos números si ya existían en la base local. | `task-3-report.md`: log `PB-05 evidencia: la secuencia local pedido_numero_seq quedó adelantada` |
| PB-06 | Aprobado | fila con 312 disponibles y movimiento de entrada | `task-3-report.md`: `npm run test:pb` |
| PA-01 | Aprobado | HTTP 201, estado `creado`, subtotal 3620, IVA 434.4, total 4054.4 | `task-6-report.md`: `npx jest … pa-pedidos -t PA-01` PASS |
| PA-02 | Aprobado | HTTP 409, `lineas_sin_stock` solicitado 60 / disponible 18; stock 18/0; sin pedido nuevo | `task-4-report.md`: `npm test` unit PASS; `task-7-report.md`: `pa-pedidos -t PA-02` PASS |
| PA-03 | Aprobado | HTTP 201, línea C en `backorder`, subtotal 650, IVA 78, total 728 | `task-8-report.md`: jest `pa-pedidos -t PA-03` PASS |
| PA-04 | Aprobado | HTTP 409, conteo de pedidos sin cambio | `task-8-report.md`: jest `pa-pedidos -t PA-04` PASS |
| PA-05 | Aprobado | HTTP 400 en cantidades 0 y -1 | `task-9-report.md`: `pa-pedidos -t "PA-05\|PA-06"` PASS |
| PA-06 | Aprobado | Primer intento (UUID ausente): body sin el id; segundo intento: 400 con mensaje que incluye `11111111-1111-4111-8111-111111111111`; producto inactivo igual | `task-9-report.md`: bodies JSON antes/después del fix en `pedidos.service.ts` |
| PA-07 | Aprobado | HTTP 423, stock disponible 100 / reservado 0 | `task-10-report.md`: `pa-pedidos -t PA-07` PASS |
| PA-08 | Aprobado | Intento 1: timeout 8000 ms; intento 2: HTTP 423, stock 50/0 | `task-11-report.md`: `npx jest … pa-08-redis` PASS tras ajuste en `lock.service.ts` |
| PA-09 | Aprobado | Unit: compensación con `liberar_stock` 10; E2E: status ≠ 201, stock 40/0, sin pedido nuevo | `task-12-report.md`: `pedidos.compensacion.spec.ts` y `pa-pedidos -t PA-09` PASS |
| PA-10 | Aprobado | status 201, 201, 409, 409, 201; disponible 10; reservado 90 | `task-5-report.md`: `npm run test:e2e -- --testPathPattern stock.concurrency` |
| PA-11 | Aprobado | Dos POST paralelos: ambos HTTP 201 (`Promise.all`) | `task-13-report.md`: log `inicios [t, t] fin …`; `pa-pedidos -t "PA-11\|PA-12\|PA-13"` PASS |
| PA-12 | Aprobado | Cancelación → `cancelado`; stock 100/0; movimiento `liberacion` cantidad 40 | `task-13-report.md`: `pa-pedidos -t "PA-11\|PA-12\|PA-13"` PASS |
| PA-13 | Aprobado | Cancelar pedido `despachado` → HTTP 409; estado y stock sin cambio | `task-13-report.md`: `pa-pedidos -t "PA-11\|PA-12\|PA-13"` PASS |
| PA-14 | Aprobado | Dos procesamientos del mismo pedido → 1 tarea y 1 línea de picking | `task-14-report.md`: `pa-picking -t PA-14` PASS |
| PA-15 | Aprobado | HTTP 201, disponible 210, movimiento `entrada` 200 con referencia = codigo | `task-15-report.md`: `pa-inventario -t PA-15` PASS |
| PA-16 | Aprobado | HTTP 409; stock 312/0/0 sin cambios | `task-16-report.md`: `pa-inventario -t "PA-16\|ajuste positivo"` PASS |
| PA-17 | Aprobado | HTTP 201, disponible 8, dañado 2 | `task-17-report.md`: `pa-inventario -t PA-17` PASS |
| PA-18 | Aprobado | HTTP 409, `cantidad_recogida` 0, cuerpo con SKU ajeno | `task-18-report.md`: `pa-picking -t "PA-18\|PA-19\|PA-20"` PASS |
| PA-19 | Aprobado | HTTP 409, `cantidad_recogida` 0 | `task-18-report.md`: `pa-picking -t "PA-18\|PA-19\|PA-20"` PASS |
| PA-20 | Aprobado | Cierre sin flag → 409; con `{ faltante: true }` → 200, estado `con_faltante` | `task-18-report.md`: `pa-picking -t "PA-18\|PA-19\|PA-20"` PASS |
| PA-21 | Bloqueado | `POST calcular-ruta` HTTP 502; Jest: `BLOQUEADO: el motor de rutas respondió 502. No se inventa distancia ni ETA.` | `task-20-report.md`: `pa-despachos -t PA-21` exit 1 |
| PA-22 | Aprobado | HTTP 502, sin `distancia_km`; spy vio URL OSRM (`127.0.0.1:9`) y Google (`maps.googleapis.com`); mensaje contiene `El motor de rutas no respondió` | `task-19-report.md`: `pa-despachos -t PA-22` PASS |
| PA-23 | Aprobado | Primer despacho 201; segundo con mismo pedido 409; una fila en `despacho_paradas` | `task-21-report.md`: `pa-despachos -t "PA-23\|PA-24"` PASS |
| PA-24 | Aprobado | Tras dos entregas 200, despacho `finalizado` y ambos pedidos `entregado` | `task-21-report.md`: `pa-despachos -t "PA-23\|PA-24"` PASS |
| PS-01 | Aprobado | `GET /api/v1/pedidos` sin token → HTTP 401 | `task-22-report.md`: `ps.e2e-spec.ts` PASS |
| PS-02 | Aprobado | JWT con `sub` alterado → HTTP 401 | `task-22-report.md`: `ps.e2e-spec.ts` PASS |
| PS-03 | Aprobado | Operario `POST /api/v1/pedidos` → HTTP 403 | `task-22-report.md`: `ps.e2e-spec.ts` PASS |
| PS-04 | Aprobado | Asesor `GET /api/v1/reportes/resumen` → HTTP 403 (Forbidden, no 501) | `task-22-report.md`: log `PS-04 body 403 …` |
| PS-05 | Aprobado | Asesor `select` pedidos → 0 filas; operario ve ≥ 1 fila | `task-22-report.md`: `ps.e2e-spec.ts` PASS |
| PS-06 | Bloqueado | Status reales: pedido 201, entrada 201, despacho 201, reporte 501; Jest `BLOQUEADO:` | `task-22-report.md`: log `{"pedido":201,"entrada":201,"despacho":201,"reporte":501}` |
| PR-01 | Aprobado | `{"solicitudes":16792,"p95_ms":441.44145800000024,"errores5xx":0}`, exit 0 (umbral p95 &lt; 800 ms) | `task-24-report.md`: `node test/pr01.mjs` con health previo ok |
| PR-02 | Aprobado | 10×201, 90 rechazos (409\|423), 0×5xx, stock disponible 0 / reservado 10 | `task-23-report.md`: `npm run test:pr02`, log `aceptadas:10,rechazadas:90` |
| PU-01 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-02 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-03 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |
| PU-04 | No ejecutable | no se ejecutó | No ejecutable: sin frontend. No hay aplicación de interfaz en `logistock/`. |

## Totales

| Estado | Cantidad |
|---|---|
| Aprobado | 36 |
| Falló | 0 |
| Bloqueado | 2 |
| No ejecutable | 4 |
| Total | 42 |

## Cambios de código

Lista tomada de `git log` de esta corrida (`77e9dd5..a0a1d59` en rama `logistock/pruebas-seccion-3-4`): archivo, qué cambió y qué caso lo obligó.

- `77e9dd5` — `lock.service.ts`: código HTTP 423 literal (Nest 10); base para PA-07/PA-08 y rechazos 423 en PR-02.
- `7b43385` — `grants_local.sql`, `.env.example`, `test/helpers/local.ts`, scripts de prueba: entorno local PB/PA/PS/PR.
- `31d7b8f` / `8b6384a` — `semilla.ts`, `pb.e2e-spec.ts`, dependencia `ws`: PB-01..PB-06 en Node 20.
- `ec8d2bc` — `pedidos.service.spec.ts`: PA-02 unitario 409 con `lineas_sin_stock`.
- `da87154` — `pedidos.module.ts`, `cola-picking.ts`: inyección Nest para PA-10/PR.
- `2801c5e` — `stock.concurrency.e2e-spec.ts`: PA-10 concurrencia cinco pedidos.
- `01e156c` … `8250482` — `pa-pedidos.e2e-spec.ts` (+ compensación): PA-01..PA-13.
- `d9fb11b` — `pa-08-redis.e2e-spec.ts`, opciones Redis en `lock.service.ts`: PA-08.
- `88f62f5` — `pedidos.compensacion.spec.ts`, PA-09 en `pa-pedidos.e2e-spec.ts`.
- `cbb04ba` — `pa-picking.e2e-spec.ts`: PA-14 idempotencia worker.
- `45d78ed` … `c45b942` — módulo inventario + `pa-inventario.e2e-spec.ts`: PA-15..PA-17.
- `8e393de` — módulo picking + `pa-picking.e2e-spec.ts`: PA-18..PA-20.
- `e43bb2a` / `1b2fd10` / `ee80ba2` — despachos, `rutas.client.ts`, `pa-despachos.e2e-spec.ts`: PA-21..PA-24.
- `5857389` — `ps.e2e-spec.ts`: PS-01..PS-06.
- `dd203a3` — `pr02.e2e-spec.ts`: PR-02.
- `a0a1d59` — `pr01.mjs`, polyfill WebSocket en `supabase.service.ts`: PR-01.
