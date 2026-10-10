import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

export const COLA_PICKING = 'picking';

@Module({
  imports: [BullModule.registerQueue({ name: COLA_PICKING })],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
