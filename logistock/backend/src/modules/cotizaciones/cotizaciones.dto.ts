import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { LineaNuevaDto } from '../pedidos/pedidos.dto';

export class CotizacionNuevaDto {
  @IsUUID() cliente_id: string;
  @IsUUID() bodega_id: string;
  @ValidateNested({ each: true }) @Type(() => LineaNuevaDto) @ArrayMinSize(1) lineas: LineaNuevaDto[];
}

export class FiltroCotizacionesDto {
  @IsOptional() @IsUUID() cliente_id?: string;
}
