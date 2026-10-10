import { Body, Controller, Get, HttpCode, NotImplementedException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { RutaSolicitudDto } from './despachos.dto';
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
  crear() { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Get(':id')
  obtener(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Post(':id/iniciar')
  iniciar(@Param('id') _id: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }

  @Post(':id/paradas/:paradaId/entregar')
  entregar(@Param('id') _id: string, @Param('paradaId') _p: string) { throw new NotImplementedException('Pendiente: Iteración 3'); }
}
