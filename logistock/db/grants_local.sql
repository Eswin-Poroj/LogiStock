grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant select on all tables in schema public to authenticated;
grant execute on function public.rol_actual() to authenticated;
