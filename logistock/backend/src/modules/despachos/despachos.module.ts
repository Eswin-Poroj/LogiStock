import { Module } from '@nestjs/common';
import { DespachosController } from './despachos.controller';

@Module({ controllers: [DespachosController] })
export class DespachosModule {}
