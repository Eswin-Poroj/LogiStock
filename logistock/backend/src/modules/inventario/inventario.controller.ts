import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { AjusteNuevoDto, EntradaNuevaDto } from './inventario.dto';
import { EstadoStock, InventarioService } from './inventario.service';

@ApiTags('Inventario')
@ApiBearerAuth()
@Controller('inventario')
export class InventarioController {
  constructor(private readonly servicio: InventarioService) {}

  @Get()
  listar(
    @Query('bodega_id', ParseUUIDPipe) bodegaId: string,
    @Query('q') q?: string,
    @Query('estado') estado?: EstadoStock,
  ) {
    return this.servicio.listar(bodegaId, q, estado);
  }

  @Get(':productoId/movimientos')
  movimientos(
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @Query('bodega_id', ParseUUIDPipe) bodegaId: string,
    @Query('limite') limite = 20,
  ) {
    return this.servicio.movimientos(productoId, bodegaId, Number(limite));
  }

  // Iteración 1: usará la función SQL registrar_entrada() y creará la recepción.
  @Roles('operario_bodega')
  @Post('entradas')
  entrada(@Body() dto: EntradaNuevaDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.registrarEntrada(dto, usuario);
  }

  /** Ajustes que esperan la aprobación del administrador (CU-04 A1). */
  @Roles('operario_bodega')
  @Get('ajustes/pendientes')
  pendientes(@Query('estado') estado?: string) {
    return this.servicio.ajustesPendientes(estado ?? 'pendiente');
  }

  @Roles('administrador')
  @HttpCode(200)
  @Post('ajustes/:id/aprobar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.resolverAjuste(id, true, usuario);
  }

  @Roles('administrador')
  @HttpCode(200)
  @Post('ajustes/:id/rechazar')
  rechazar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.resolverAjuste(id, false, usuario);
  }

  // CU-04: ajustes y daños. Un ajuste grande del operario queda pendiente (responde pendiente: true).
  @Roles('operario_bodega')
  @Post('ajustes')
  ajuste(@Body() dto: AjusteNuevoDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.registrarAjuste(dto, usuario);
  }
}
