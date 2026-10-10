import { Body, Controller, Get, HttpCode, NotImplementedException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { DespachoNuevoDto, RutaSolicitudDto } from './despachos.dto';
import { DespachosService } from './despachos.service';

/**
 * Iteración 3: cálculo de ruta con OSRM (respaldo Google Directions), creación del despacho
 * y confirmación de entregas.
 */
@ApiTags('Despachos')
@ApiBearerAuth()
@Roles('despachador')
@Controller('despachos')
export class DespachosController {
  constructor(private readonly servicio: DespachosService) {}

  @Get()
  listar() { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @HttpCode(200)
  @Post('calcular-ruta')
  calcularRuta(@Body() dto: RutaSolicitudDto) {
    return this.servicio.calcularRuta(dto);
  }

  @Post()
  crear(@Body() dto: DespachoNuevoDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.crear(dto, usuario);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.obtener(id);
  }

  @Post(':id/iniciar')
  iniciar(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @HttpCode(200)
  @Post(':id/paradas/:paradaId/entregar')
  entregar(@Param('id', ParseUUIDPipe) id: string, @Param('paradaId', ParseUUIDPipe) paradaId: string) {
    return this.servicio.entregar(id, paradaId);
  }
}
