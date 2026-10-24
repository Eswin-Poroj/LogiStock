-- =====================================================================
-- 002 · SKU automático por categoría: PREFIJO-0001, PREFIJO-0002…
-- El contador vive en la base para que dos altas simultáneas no
-- reciban el mismo número (el upsert toma el bloqueo de la fila).
-- =====================================================================

alter table productos add column if not exists categoria text;

create table if not exists sku_secuencias (
  prefijo text primary key check (prefijo ~ '^[A-Z]{2,4}$'),
  ultimo  integer not null check (ultimo > 0)
);

create or replace function siguiente_sku(p_prefijo text) returns text
language plpgsql as $$
declare v_numero integer;
begin
  -- La primera vez arranca después del mayor número que ya exista con ese prefijo.
  insert into sku_secuencias (prefijo, ultimo)
  values (p_prefijo, coalesce((
    select max((substring(sku from '^' || p_prefijo || '-([0-9]+)$'))::integer)
      from productos), 0) + 1)
  on conflict (prefijo) do update set ultimo = sku_secuencias.ultimo + 1
  returning ultimo into v_numero;
  return p_prefijo || '-' || lpad(v_numero::text, 4, '0');
end $$;

alter table sku_secuencias enable row level security;
