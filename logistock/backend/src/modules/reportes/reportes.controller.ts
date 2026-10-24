import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/roles.decorator';
import { AlertasDto, MasVendidosDto, ResumenDto } from './reportes.dto';
import { ReportesService } from './reportes.service';

/** Indicadores del periodo, más vendidos y alertas de stock (sin fechas: últimos 7 días). */
@ApiTags('Reportes')
@ApiBearerAuth()
@Roles('administrador')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly servicio: ReportesService) {}

  @Get('resumen')
  resumen(@Query() dto: ResumenDto) { return this.servicio.resumen(dto); }

  @Get('mas-vendidos')
  masVendidos(@Query() dto: MasVendidosDto) { return this.servicio.masVendidos(dto); }

  @Get('alertas-stock')
  alertas(@Query() dto: AlertasDto) { return this.servicio.alertas(dto); }
}
