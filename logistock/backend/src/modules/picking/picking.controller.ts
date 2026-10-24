import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { CompletarPickingDto, EscaneoNuevoDto, FiltroTareasDto } from './picking.dto';
import { PickingService } from './picking.service';

/** CU-05: tablero, escaneo de SKU y cierre de la tarea. */
@ApiTags('Picking')
@ApiBearerAuth()
@Roles('operario_bodega', 'despachador')
@Controller('picking/tareas')
export class PickingController {
  constructor(private readonly servicio: PickingService) {}

  @Get()
  listar(@Query() filtro: FiltroTareasDto) {
    return this.servicio.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.obtener(id);
  }

  @HttpCode(200)
  @Post(':id/escaneos')
  escanear(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EscaneoNuevoDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.escanear(id, dto, usuario);
  }

  @HttpCode(200)
  @Post(':id/completar')
  completar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompletarPickingDto) {
    return this.servicio.completar(id, dto);
  }
}
