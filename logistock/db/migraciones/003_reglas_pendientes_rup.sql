-- =====================================================================
-- 003 · Reglas del RUP que faltaban:
--   CU-01 A2  descuento sobre el límite con autorización de un supervisor.
--   CU-04 A1  ajustes grandes quedan pendientes de aprobación.
--   CU-06 A2  peso del producto para comparar la carga con el vehículo.
--   CU-05 E2  aviso al asesor cuando el picking queda con faltante.
-- Idempotente.
-- =====================================================================

alter table pedidos add column if not exists descuento_pct numeric(5,2) not null default 0
  check (descuento_pct >= 0 and descuento_pct <= 100);
alter table pedidos add column if not exists descuento numeric(12,2) not null default 0 check (descuento >= 0);
alter table pedidos add column if not exists autorizado_por uuid references usuarios(id);

alter table productos add column if not exists peso_kg numeric(10,3) not null default 0 check (peso_kg >= 0);

do $$ begin
  create type estado_aprobacion as enum ('pendiente', 'aprobado', 'rechazado');
exception when duplicate_object then null; end $$;

create table if not exists ajustes_pendientes (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references productos(id),
  bodega_id      uuid not null references bodegas(id),
  cantidad       integer not null check (cantidad <> 0),
  motivo         text not null,
  estado         estado_aprobacion not null default 'pendiente',
  solicitado_por uuid not null references usuarios(id),
  revisado_por   uuid references usuarios(id),
  movimiento_id  uuid references movimientos_stock(id),
  created_at     timestamptz not null default now(),
  revisado_at    timestamptz
);
create index if not exists idx_ajustes_pendientes_estado on ajustes_pendientes (estado, created_at desc);

create table if not exists notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  tipo        text not null,
  mensaje     text not null,
  pedido_id   uuid references pedidos(id) on delete cascade,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notificaciones_usuario on notificaciones (usuario_id, leida, created_at desc);

alter table ajustes_pendientes enable row level security;
alter table notificaciones     enable row level security;
drop policy if exists notificaciones_propias on notificaciones;
create policy notificaciones_propias on notificaciones for select using (usuario_id = auth.uid());
