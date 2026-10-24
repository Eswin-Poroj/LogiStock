import { Type } from 'class-transformer';
import { ArrayMinSize, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class LineaNuevaDto {
  @IsUUID() producto_id: string;
  @IsInt() @Min(1) cantidad: number;
}

/** Credenciales del supervisor que autoriza un descuento sobre el límite (CU-01 A2). */
export class AutorizacionDto {
  @IsEmail() correo: string;
  @IsString() clave: string;
}

export class PedidoNuevoDto {
  @IsUUID() cliente_id: string;
  @IsUUID() bodega_id: string;
  @IsOptional() @IsIn(['rechazar', 'backorder']) politica_faltantes?: 'rechazar' | 'backorder';
  @ValidateNested({ each: true }) @Type(() => LineaNuevaDto) @ArrayMinSize(1) lineas: LineaNuevaDto[];
  /** Si el pedido nace de una cotización guardada, queda enlazada a él. */
  @IsOptional() @IsUUID() cotizacion_id?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) descuento_pct?: number;
  @IsOptional() @ValidateNested() @Type(() => AutorizacionDto) autorizacion?: AutorizacionDto;
}
