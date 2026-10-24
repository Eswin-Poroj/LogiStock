import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class RutaSolicitudDto {
  @IsUUID() bodega_id: string;
  /** Si viene, la respuesta compara la carga con su capacidad (CU-06 A2). */
  @IsOptional() @IsUUID() vehiculo_id?: string;
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
  /** Lo que devolvió calcular-ruta, para que reportes y seguimiento lo muestren. */
  @IsOptional() @IsNumber() @Min(0) distancia_km?: number;
  @IsOptional() @IsInt() @Min(0) duracion_min?: number;
  @ValidateNested({ each: true }) @Type(() => DespachoParadaNuevaDto) @ArrayMinSize(1) paradas: DespachoParadaNuevaDto[];
  /** El jefe de logística vio el aviso de sobrecarga y asigna de todos modos. */
  @IsOptional() @IsBoolean() aceptar_exceso?: boolean;
}

export class FiltroDespachosDto {
  @IsOptional() @IsIn(['planificado', 'en_ruta', 'finalizado', 'cancelado']) estado?: string;
}
