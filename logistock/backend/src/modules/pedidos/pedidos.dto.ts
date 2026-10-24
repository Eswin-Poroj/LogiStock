import { Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class LineaNuevaDto {
  @IsUUID() producto_id: string;
  @IsInt() @Min(1) cantidad: number;
}

export class PedidoNuevoDto {
  @IsUUID() cliente_id: string;
  @IsUUID() bodega_id: string;
  @IsOptional() @IsIn(['rechazar', 'backorder']) politica_faltantes?: 'rechazar' | 'backorder';
  @ValidateNested({ each: true }) @Type(() => LineaNuevaDto) @ArrayMinSize(1) lineas: LineaNuevaDto[];
  /** Si el pedido nace de una cotización guardada, queda enlazada a él. */
  @IsOptional() @IsUUID() cotizacion_id?: string;
}
