# LogiStock frontend

Una sola aplicación Vite + React + TypeScript. Habla con el NestJS que ya está en `logistock/backend`. No hay otro backend.

Hace falta Node 20. No subas la versión de Node.

## API

La base es `http://127.0.0.1:3000/api/v1`. Si quieres fijarla en un archivo, copia `.env.example` a `.env`. Otro host hace que el cliente lance antes de llamar a la red.

## Comandos

Desde la raíz del repositorio:

```bash
cd logistock/frontend
npm install
npm test
npm run dev
```

`npm test` corre Vitest una vez y cubre el aviso de stock, el botón Confirmar pedido, el menú por rol, los 44 px, las pantallas que ya tienen endpoint y el 501 tal como lo devuelve la API. `npm run dev` sirve la interfaz en `http://127.0.0.1:5173` con la API en el puerto 3000.

## Qué no toca este frontend

No cambies PU-01, PU-02, PU-03 ni PU-04 a Aprobado en `docs/resultados_pruebas.md`. Esas filas siguen en No ejecutable hasta una corrida de evidencia que este README no hace. `npm test` no reescribe ese archivo.

No cambies `retryCount`, `retryDelay`, `retryJitter` ni `LOCK_TTL_MS` del backend.
