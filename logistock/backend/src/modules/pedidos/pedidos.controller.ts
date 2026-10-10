import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles, UsuarioActual } from '../../common/auth/roles.decorator';
import { PedidoNuevoDto } from './pedidos.dto';
import { PedidosService } from './pedidos.service';

@ApiTags('Pedidos')
@ApiBearerAuth()
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly servicio: PedidosService) {}

  @Get()
  listar(@Query('estado') estado?: string, @Query('cliente_id') clienteId?: string, @Query('pagina') pagina = 1, @Query('limite') limite = 20) {
    return this.servicio.listar(estado, clienteId, Number(pagina), Number(limite));
  }

  /** CU-01 Crear Pedido de Venta (incluye CU-02 Validar Stock). */
  @Roles('asesor_ventas')
  @Post()
  crear(@Body() dto: PedidoNuevoDto, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.crear(dto, usuario);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.obtener(id);
  }

  @Roles('asesor_ventas')
  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioActual) {
    return this.servicio.cancelar(id, usuario);
  }
}
