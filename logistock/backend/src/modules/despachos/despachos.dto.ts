import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class RutaSolicitudDto {
  @IsUUID() bodega_id: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) pedido_ids: string[];
  @IsOptional() @IsString() salida_prevista?: string;
}

export class DespachoParadaNuevaDto {
  @IsUUID() pedido_id: string;
  @IsInt() @Min(1) orden: number;
  @IsOptional() @IsString() eta?: string;
}

export class DespachoNuevoDto {
  @IsUUID() vehiculo_id: string;
  @IsUUID() conductor_id: string;
  @IsUUID() bodega_id: string;
  @IsOptional() @IsString() salida_prevista?: string;
  @ValidateNested({ each: true }) @Type(() => DespachoParadaNuevaDto) @ArrayMinSize(1) paradas: DespachoParadaNuevaDto[];
}
