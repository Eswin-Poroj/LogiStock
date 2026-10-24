import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { DespachoNuevoDto, FiltroDespachosDto, RutaSolicitudDto } from './despachos.dto';
import { DespachosService } from './despachos.service';

/**
 * CU-06 y CU-07: cálculo de ruta con OSRM (respaldo Google Directions), asignación del despacho,
 * inicio de la ruta y confirmación de entregas.
 */
@ApiTags('Despachos')
@ApiBearerAuth()
@Roles('despachador')
@Controller('despachos')
export class DespachosController {
  constructor(private readonly servicio: DespachosService) {}

  @Get()
  listar(@Query() filtro: FiltroDespachosDto) {
    return this.servicio.listar(filtro.estado);
  }

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

  @HttpCode(200)
  @Post(':id/iniciar')
  iniciar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.iniciar(id);
  }

  @HttpCode(200)
  @Post(':id/paradas/:paradaId/entregar')
  entregar(@Param('id', ParseUUIDPipe) id: string, @Param('paradaId', ParseUUIDPipe) paradaId: string) {
    return this.servicio.entregar(id, paradaId);
  }

  /** Solo despachos sin paradas: con pedidos asignados el stock ya salió y la ruta es historial. */
  @HttpCode(204)
  @Delete(':id')
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminar(id);
  }
}
