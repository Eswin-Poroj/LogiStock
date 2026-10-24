export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
  },
  redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  rutas: {
    osrmUrl: process.env.OSRM_URL ?? 'http://localhost:5000',
    googleKey: process.env.GOOGLE_DIRECTIONS_API_KEY ?? '',
  },
  ivaPorcentaje: parseFloat(process.env.IVA_PORCENTAJE ?? '12'),
  lockTtlMs: parseInt(process.env.LOCK_TTL_MS ?? '5000', 10),
});
