import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { SupabaseModule } from './common/supabase/supabase.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { PickingModule } from './modules/picking/picking.module';
import { DespachosModule } from './modules/despachos/despachos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';

function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return { host: u.hostname, port: Number(u.port || 6379), password: u.password || undefined };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRoot({ connection: redisConnection() }),
    SupabaseModule,
    RedisModule,
    AuthModule,
    HealthModule,
    CatalogosModule,
    InventarioModule,
    PedidosModule,
    PickingModule,
    DespachosModule,
    ReportesModule,
    CotizacionesModule,
    NotificacionesModule,
  ],
})
export class AppModule {}
