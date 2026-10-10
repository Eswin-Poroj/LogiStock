import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';

/** Transición: indicadores, más vendidos y alertas de stock. */
@ApiTags('Reportes')
@ApiBearerAuth()
@Roles('administrador')
@Controller('reportes')
export class ReportesController {
  @Get('resumen')
  resumen() { throw new NotImplementedException('Pendiente'); }

  @Get('mas-vendidos')
  masVendidos() { throw new NotImplementedException('Pendiente'); }

  @Get('alertas-stock')
  alertas() { throw new NotImplementedException('Pendiente'); }
}
