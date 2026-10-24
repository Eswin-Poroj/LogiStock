import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';

@Module({ controllers: [NotificacionesController] })
export class NotificacionesModule {}
