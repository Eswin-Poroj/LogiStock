import { Body, Controller, Get, HttpCode, NotImplementedException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { CompletarPickingDto, EscaneoNuevoDto } from './picking.dto';
import { PickingService } from './picking.service';

/** Iteración 3: tablero, escaneo de SKU y cierre de la tarea. */
@ApiTags('Picking')
@ApiBearerAuth()
@Roles('operario_bodega', 'despachador')
@Controller('picking/tareas')
export class PickingController {
  constructor(private readonly servicio: PickingService) {}

  @Get()
  listar() { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.servicio.obtener(id);
  }

  @HttpCode(200)
  @Post(':id/escaneos')
  escanear(@Param('id') id: string, @Body() dto: EscaneoNuevoDto) {
    return this.servicio.escanear(id, dto);
  }

  @HttpCode(200)
  @Post(':id/completar')
  completar(@Param('id') id: string, @Body() dto: CompletarPickingDto) {
    return this.servicio.completar(id, dto);
  }
}
