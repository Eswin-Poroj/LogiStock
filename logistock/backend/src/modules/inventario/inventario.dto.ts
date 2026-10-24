import { Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsInt, IsNotEmpty, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaEntradaDto {
  @IsUUID() producto_id: string;
  @IsInt() @Min(1) cantidad: number;
}

export class EntradaNuevaDto {
  @IsUUID() proveedor_id: string;
  @IsUUID() bodega_id: string;
  @ValidateNested({ each: true }) @Type(() => LineaEntradaDto) @ArrayMinSize(1) lineas: LineaEntradaDto[];
}

export class AjusteNuevoDto {
  @IsUUID() producto_id: string;
  @IsUUID() bodega_id: string;
  @IsIn(['ajuste', 'danio']) tipo: 'ajuste' | 'danio';
  @IsInt() cantidad: number;
  /** CU-04 paso 2: el motivo es obligatorio en ajuste y en daño. */
  @IsString() @IsNotEmpty() motivo: string;
}
