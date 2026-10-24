import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller';
import { ConfiguracionController } from './configuracion.controller';

@Module({ controllers: [CatalogosController, ConfiguracionController] })
export class CatalogosModule {}
