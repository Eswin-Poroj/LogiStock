-- =====================================================================
-- 004 · Dirección opcional del proveedor, con la misma búsqueda y mapa
--       que clientes y bodegas. Idempotente.
-- =====================================================================
alter table proveedores add column if not exists direccion text;
alter table proveedores add column if not exists latitud   numeric(9,6) check (latitud  between -90  and 90);
alter table proveedores add column if not exists longitud  numeric(9,6) check (longitud between -180 and 180);
