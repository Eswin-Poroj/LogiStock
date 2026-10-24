import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { CotizacionNuevaDto, FiltroCotizacionesDto } from './cotizaciones.dto';
import { CotizacionesService } from './cotizaciones.service';

/** Visión v1: cotizaciones guardadas que luego se confirman como pedido (CU-01 paso 4). */
@ApiTags('Cotizaciones')
@ApiBearerAuth()
@Roles('asesor_ventas')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly servicio: CotizacionesService) {}

  @Get()
  listar(@Query() filtro: FiltroCotizacionesDto) {
    return this.servicio.listar(filtro.cliente_id);
  }

  @Post()
  crear(@Body() dto: CotizacionNuevaDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.crear(dto, usuario);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.obtener(id);
  }

  /** La cotización no reservó stock: se puede borrar siempre; el pedido que generó no cambia. */
  @HttpCode(204)
  @Delete(':id')
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminar(id);
  }
}
