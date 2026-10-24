import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Límites de negocio que la interfaz necesita para avisar antes de enviar (RUP: CU-01 A2, CU-04 A1). */
@ApiTags('Sistema')
@ApiBearerAuth()
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  obtener() {
    return {
      iva_pct: this.config.get<number>('ivaPorcentaje', 12),
      descuento_max_pct: this.config.get<number>('descuentoMaxPct', 10),
      ajuste_max_pct: this.config.get<number>('ajusteMaxPct', 20),
    };
  }
}
