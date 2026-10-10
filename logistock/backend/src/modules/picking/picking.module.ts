import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COLA_PICKING } from '../pedidos/pedidos.module';
import { PickingController } from './picking.controller';
import { PickingProcessor } from './picking.processor';
import { PickingService } from './picking.service';

@Module({
  imports: [BullModule.registerQueue({ name: COLA_PICKING })],
  controllers: [PickingController],
  providers: [PickingProcessor, PickingService],
})
export class PickingModule {}
