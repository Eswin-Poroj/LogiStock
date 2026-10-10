import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaEntradaDto {
  @IsUUID() producto_id: string;
  @IsInt() @Min(1) cantidad: number;
}

export class EntradaNuevaDto {
  @IsUUID() proveedor_id: string;
  @IsUUID() bodega_id: string;
  @ValidateNested({ each: true }) @Type(() => LineaEntradaDto) @ArrayMinSize(1) lineas: LineaEntradaDto[];
}
