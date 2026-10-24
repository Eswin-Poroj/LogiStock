-- =====================================================================
-- 001 · Funciones y tablas para habilitar todo el alcance v1 del RUP.
--   · ajustar_stock(): ajuste con signo de CU-04 en una sola sentencia.
--   · despachar_stock(): "Reservado sale del inventario" al asignar (CU-06).
--   · cotizaciones: guardar la cotización sin reservar stock (Visión, CU-01 paso 4).
-- Idempotente: se puede aplicar sobre una base que ya tiene schema.sql.
-- =====================================================================

create or replace function ajustar_stock(
  p_producto uuid, p_bodega uuid, p_cantidad integer,
  p_motivo text, p_usuario uuid
) returns movimientos_stock
language plpgsql as $$
declare v_mov movimientos_stock;
begin
  if p_cantidad = 0 then
    raise exception 'La cantidad del ajuste debe ser distinta de cero';
  end if;
  update stock
     set disponible = disponible + p_cantidad,
         updated_at = now()
   where producto_id = p_producto and bodega_id = p_bodega
     and disponible + p_cantidad >= 0;
  if not found then
    return null;                        -- dejaría el disponible en negativo
  end if;
  insert into movimientos_stock (producto_id, bodega_id, tipo, cantidad, referencia, usuario_id)
  values (p_producto, p_bodega, 'ajuste', p_cantidad, p_motivo, p_usuario)
  returning * into v_mov;
  return v_mov;
end $$;

create or replace function despachar_stock(
  p_producto uuid, p_bodega uuid, p_cantidad integer,
  p_referencia text, p_usuario uuid
) returns void
language plpgsql as $$
begin
  update stock
     set reservado  = reservado - p_cantidad,
         updated_at = now()
   where producto_id = p_producto and bodega_id = p_bodega
     and reservado >= p_cantidad;
  if not found then
    raise exception 'No hay suficiente stock reservado para despachar';
  end if;
  insert into movimientos_stock (producto_id, bodega_id, tipo, cantidad, referencia, usuario_id)
  values (p_producto, p_bodega, 'despacho', -p_cantidad, p_referencia, p_usuario);
end $$;

create sequence if not exists cotizacion_numero_seq start 1;

create table if not exists cotizaciones (
  id          uuid primary key default gen_random_uuid(),
  numero      text          not null unique
              default ('COT-' || lpad(nextval('cotizacion_numero_seq')::text, 6, '0')),
  cliente_id  uuid          not null references clientes(id),
  bodega_id   uuid          not null references bodegas(id),
  subtotal    numeric(12,2) not null default 0 check (subtotal >= 0),
  iva         numeric(12,2) not null default 0 check (iva      >= 0),
  total       numeric(12,2) not null default 0 check (total    >= 0),
  pedido_id   uuid references pedidos(id) on delete set null,   -- al convertirse en pedido
  creado_por  uuid          not null references usuarios(id),
  created_at  timestamptz   not null default now()
);

create table if not exists cotizacion_lineas (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid          not null references cotizaciones(id) on delete cascade,
  producto_id     uuid          not null references productos(id),
  cantidad        integer       not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal        numeric(12,2) generated always as (cantidad * precio_unitario) stored,
  unique (cotizacion_id, producto_id)
);

alter table cotizaciones      enable row level security;
alter table cotizacion_lineas enable row level security;
drop policy if exists cotizaciones_lectura on cotizaciones;
create policy cotizaciones_lectura on cotizaciones for select using (auth.uid() is not null);
drop policy if exists cot_lineas_lectura on cotizacion_lineas;
create policy cot_lineas_lectura on cotizacion_lineas for select using (auth.uid() is not null);
