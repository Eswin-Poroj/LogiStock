-- =====================================================================
-- LogiStock · Modelo de datos (PostgreSQL / Supabase)
-- Proyecto Análisis de Sistemas II · UMG Quetzaltenango
-- Ejecutar en el SQL Editor de Supabase o con: psql -f schema.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tipos enumerados
-- ---------------------------------------------------------------------
create type rol_usuario        as enum ('asesor_ventas','operario_bodega','despachador','administrador');
create type estado_pedido      as enum ('creado','en_preparacion','despachado','entregado','cancelado');
create type estado_linea       as enum ('reservada','backorder');
create type estado_picking     as enum ('pendiente','en_curso','completado','con_faltante');
create type estado_despacho    as enum ('planificado','en_ruta','finalizado','cancelado');
create type estado_recepcion   as enum ('pendiente','recibida','cancelada');
create type tipo_movimiento    as enum ('entrada','reserva','liberacion','despacho','ajuste','danio','transferencia');

-- ---------------------------------------------------------------------
-- 2. Catálogos y actores
-- ---------------------------------------------------------------------
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text        not null,
  rol         rol_usuario not null,
  bodega_id   uuid,                       -- bodega habitual (FK se agrega abajo)
  activo      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table bodegas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null unique,
  direccion   text,
  latitud     numeric(9,6),
  longitud    numeric(9,6),
  activa      boolean     not null default true
);

alter table usuarios
  add constraint usuarios_bodega_fk foreign key (bodega_id) references bodegas(id);

create table clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  nit         text        not null unique,
  telefono    text,
  direccion   text,
  municipio   text,
  latitud     numeric(9,6),
  longitud    numeric(9,6),
  created_at  timestamptz not null default now()
);

create table proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  nit         text        unique,
  telefono    text,
  correo      text
);

create table productos (
  id              uuid primary key default gen_random_uuid(),
  sku             text           not null unique,
  nombre          text           not null,
  unidad          text           not null default 'unidad',
  precio_unitario numeric(12,2)  not null check (precio_unitario >= 0),
  stock_minimo    integer        not null default 0 check (stock_minimo >= 0),
  activo          boolean        not null default true,
  created_at      timestamptz    not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Inventario (RF-01, RF-02). Un registro por producto y bodega.
-- ---------------------------------------------------------------------
create table stock (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid    not null references productos(id),
  bodega_id    uuid    not null references bodegas(id),
  ubicacion    text,
  disponible   integer not null default 0 check (disponible  >= 0),
  reservado    integer not null default 0 check (reservado   >= 0),
  en_transito  integer not null default 0 check (en_transito >= 0),
  danado       integer not null default 0 check (danado      >= 0),
  updated_at   timestamptz not null default now(),
  unique (producto_id, bodega_id)
);

create table movimientos_stock (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid            not null references productos(id),
  bodega_id      uuid            not null references bodegas(id),
  tipo           tipo_movimiento not null,
  cantidad       integer         not null check (cantidad <> 0),  -- con signo
  referencia     text,                                            -- PED-000231, OC-004118...
  usuario_id     uuid references usuarios(id),
  created_at     timestamptz     not null default now()
);
create index idx_mov_producto_fecha on movimientos_stock (producto_id, bodega_id, created_at desc);

create table recepciones (
  id            uuid primary key default gen_random_uuid(),
  codigo        text              not null unique,
  proveedor_id  uuid              not null references proveedores(id),
  bodega_id     uuid              not null references bodegas(id),
  estado        estado_recepcion  not null default 'pendiente',
  recibida_por  uuid references usuarios(id),
  created_at    timestamptz       not null default now(),
  recibida_at   timestamptz
);

create table recepcion_lineas (
  id            uuid primary key default gen_random_uuid(),
  recepcion_id  uuid    not null references recepciones(id) on delete cascade,
  producto_id   uuid    not null references productos(id),
  cantidad      integer not null check (cantidad > 0)
);

-- ---------------------------------------------------------------------
-- 4. Pedidos de venta (CU-01)
-- ---------------------------------------------------------------------
create sequence pedido_numero_seq start 1;

create table pedidos (
  id          uuid primary key default gen_random_uuid(),
  numero      text          not null unique
              default ('PED-' || lpad(nextval('pedido_numero_seq')::text, 6, '0')),
  cliente_id  uuid          not null references clientes(id),
  bodega_id   uuid          not null references bodegas(id),
  estado      estado_pedido not null default 'creado',
  subtotal    numeric(12,2) not null default 0 check (subtotal >= 0),
  iva         numeric(12,2) not null default 0 check (iva      >= 0),
  total       numeric(12,2) not null default 0 check (total    >= 0),
  creado_por  uuid          not null references usuarios(id),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);
create index idx_pedidos_estado  on pedidos (estado, created_at desc);
create index idx_pedidos_cliente on pedidos (cliente_id);

create table pedido_lineas (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid          not null references pedidos(id) on delete cascade,
  producto_id     uuid          not null references productos(id),
  cantidad        integer       not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal        numeric(12,2) generated always as (cantidad * precio_unitario) stored,
  estado          estado_linea  not null default 'reservada',
  unique (pedido_id, producto_id)
);

-- ---------------------------------------------------------------------
-- 5. Picking (RF-05)
-- ---------------------------------------------------------------------
create table tareas_picking (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid           not null unique references pedidos(id) on delete cascade,
  operario_id  uuid references usuarios(id),
  estado       estado_picking not null default 'pendiente',
  created_at   timestamptz    not null default now(),
  completada_at timestamptz
);

create table picking_lineas (
  id               uuid primary key default gen_random_uuid(),
  tarea_id         uuid    not null references tareas_picking(id) on delete cascade,
  pedido_linea_id  uuid    not null unique references pedido_lineas(id) on delete cascade,
  cantidad_recogida integer not null default 0 check (cantidad_recogida >= 0)
);

-- ---------------------------------------------------------------------
-- 6. Despacho y rutas (RF-06)
-- ---------------------------------------------------------------------
create table vehiculos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text    not null unique,
  placa       text    not null unique,
  capacidad_kg integer not null check (capacidad_kg > 0),
  activo      boolean not null default true
);

create table conductores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  activo      boolean not null default true
);

create table despachos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text             not null unique,
  vehiculo_id   uuid             not null references vehiculos(id),
  conductor_id  uuid             not null references conductores(id),
  bodega_id     uuid             not null references bodegas(id),
  estado        estado_despacho  not null default 'planificado',
  distancia_km  numeric(8,2),
  duracion_min  integer,
  salida_prevista timestamptz,
  creado_por    uuid references usuarios(id),
  created_at    timestamptz      not null default now()
);

create table despacho_paradas (
  id           uuid primary key default gen_random_uuid(),
  despacho_id  uuid    not null references despachos(id) on delete cascade,
  pedido_id    uuid    not null unique references pedidos(id),
  orden        integer not null check (orden > 0),
  eta          timestamptz,
  entregada_at timestamptz,
  unique (despacho_id, orden)
);

-- ---------------------------------------------------------------------
-- 7. Funciones transaccionales
--    Reserva atómica: el UPDATE condicionado evita stock negativo aun si
--    el lock distribuido de Redis fallara (defensa en profundidad, R1).
-- ---------------------------------------------------------------------
create or replace function reservar_stock(
  p_producto uuid, p_bodega uuid, p_cantidad integer,
  p_referencia text, p_usuario uuid
) returns boolean
language plpgsql as $$
declare v_filas integer;
begin
  if p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;

  update stock
     set disponible = disponible - p_cantidad,
         reservado  = reservado  + p_cantidad,
         updated_at = now()
   where producto_id = p_producto
     and bodega_id   = p_bodega
     and disponible >= p_cantidad;

  get diagnostics v_filas = row_count;
  if v_filas = 0 then
    return false;                       -- stock insuficiente
  end if;

  insert into movimientos_stock (producto_id, bodega_id, tipo, cantidad, referencia, usuario_id)
  values (p_producto, p_bodega, 'reserva', -p_cantidad, p_referencia, p_usuario);
  return true;
end $$;

create or replace function liberar_stock(
  p_producto uuid, p_bodega uuid, p_cantidad integer,
  p_referencia text, p_usuario uuid
) returns void
language plpgsql as $$
begin
  update stock
     set disponible = disponible + p_cantidad,
         reservado  = reservado  - p_cantidad,
         updated_at = now()
   where producto_id = p_producto and bodega_id = p_bodega
     and reservado >= p_cantidad;
  if not found then
    raise exception 'No hay suficiente stock reservado para liberar';
  end if;
  insert into movimientos_stock (producto_id, bodega_id, tipo, cantidad, referencia, usuario_id)
  values (p_producto, p_bodega, 'liberacion', p_cantidad, p_referencia, p_usuario);
end $$;

-- Registra una recepción: suma al disponible y deja el movimiento.
create or replace function registrar_entrada(
  p_producto uuid, p_bodega uuid, p_cantidad integer,
  p_referencia text, p_usuario uuid
) returns void
language plpgsql as $$
begin
  insert into stock (producto_id, bodega_id, disponible)
  values (p_producto, p_bodega, p_cantidad)
  on conflict (producto_id, bodega_id)
  do update set disponible = stock.disponible + excluded.disponible, updated_at = now();
  insert into movimientos_stock (producto_id, bodega_id, tipo, cantidad, referencia, usuario_id)
  values (p_producto, p_bodega, 'entrada', p_cantidad, p_referencia, p_usuario);
end $$;

-- Transición de estado válida: creado → en_preparacion → despachado → entregado
create or replace function validar_transicion_pedido() returns trigger
language plpgsql as $$
begin
  if new.estado = old.estado then return new; end if;
  if (old.estado, new.estado) in (
      ('creado','en_preparacion'), ('en_preparacion','despachado'),
      ('despachado','entregado'),  ('creado','cancelado'),
      ('en_preparacion','cancelado')) then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'Transición de pedido no permitida: % -> %', old.estado, new.estado;
end $$;

create trigger trg_pedido_transicion
  before update of estado on pedidos
  for each row execute function validar_transicion_pedido();

-- ---------------------------------------------------------------------
-- 8. Seguridad por filas (RLS). El backend usa la service_role (omite RLS);
--    estas políticas protegen el acceso directo con el JWT de Supabase.
-- ---------------------------------------------------------------------
create or replace function rol_actual() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuarios where id = auth.uid()
$$;

alter table usuarios          enable row level security;
alter table clientes          enable row level security;
alter table productos         enable row level security;
alter table stock             enable row level security;
alter table movimientos_stock enable row level security;
alter table pedidos           enable row level security;
alter table pedido_lineas     enable row level security;
alter table tareas_picking    enable row level security;
alter table picking_lineas    enable row level security;
alter table despachos         enable row level security;
alter table despacho_paradas  enable row level security;

create policy usuarios_propio   on usuarios for select using (id = auth.uid() or rol_actual() = 'administrador');
create policy clientes_lectura  on clientes for select using (auth.uid() is not null);
create policy clientes_ventas   on clientes for all
  using (rol_actual() in ('asesor_ventas','administrador'))
  with check (rol_actual() in ('asesor_ventas','administrador'));
create policy productos_lectura on productos for select using (auth.uid() is not null);
create policy stock_lectura     on stock for select using (auth.uid() is not null);
create policy mov_lectura       on movimientos_stock for select
  using (rol_actual() in ('operario_bodega','administrador'));
create policy pedidos_lectura   on pedidos for select using (auth.uid() is not null);
create policy pedidos_ventas    on pedidos for insert
  with check (rol_actual() in ('asesor_ventas','administrador') and creado_por = auth.uid());
create policy lineas_lectura    on pedido_lineas for select using (auth.uid() is not null);
create policy picking_lectura   on tareas_picking for select
  using (rol_actual() in ('operario_bodega','despachador','administrador'));
create policy picking_oper      on tareas_picking for update
  using (rol_actual() in ('operario_bodega','administrador'));
create policy pickl_lectura     on picking_lineas for select
  using (rol_actual() in ('operario_bodega','administrador'));
create policy desp_lectura      on despachos for select
  using (rol_actual() in ('despachador','administrador'));
create policy paradas_lectura   on despacho_paradas for select
  using (rol_actual() in ('despachador','administrador'));
