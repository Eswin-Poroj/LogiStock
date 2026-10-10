import { Module } from '@nestjs/common';
import { DespachosController } from './despachos.controller';
import { DespachosService } from './despachos.service';
import { RutasClient } from './rutas.client';

@Module({
  controllers: [DespachosController],
  providers: [DespachosService, RutasClient],
})
export class DespachosModule {}
