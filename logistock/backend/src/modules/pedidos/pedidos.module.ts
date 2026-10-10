import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';
import { COLA_PICKING } from './cola-picking';

export { COLA_PICKING };

@Module({
  imports: [BullModule.registerQueue({ name: COLA_PICKING })],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
