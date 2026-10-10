import { Controller, Get, NotImplementedException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';

/** Iteración 3: tablero, escaneo de SKU y cierre de la tarea. */
@ApiTags('Picking')
@ApiBearerAuth()
@Roles('operario_bodega', 'despachador')
@Controller('picking/tareas')
export class PickingController {
  @Get()
  listar() { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Get(':id')
  obtener(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Post(':id/escaneos')
  escanear(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Post(':id/completar')
  completar(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }
}
