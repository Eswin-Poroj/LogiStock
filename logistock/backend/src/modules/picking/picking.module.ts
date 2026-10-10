import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { COLA_PICKING } from '../pedidos/pedidos.module';
import { PickingController } from './picking.controller';
import { PickingProcessor } from './picking.processor';

@Module({
  imports: [BullModule.registerQueue({ name: COLA_PICKING })],
  controllers: [PickingController],
  providers: [PickingProcessor],
})
export class PickingModule {}
