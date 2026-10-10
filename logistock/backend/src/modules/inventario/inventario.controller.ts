import { Body, Controller, Get, NotImplementedException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { EntradaNuevaDto } from './inventario.dto';
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

  // Iteración 2: ajustes y daños (mueven unidades entre disponible y dañado).
  @Roles('operario_bodega')
  @Post('ajustes')
  ajuste() {
    throw new NotImplementedException('Pendiente: Iteración 2');
  }
}
