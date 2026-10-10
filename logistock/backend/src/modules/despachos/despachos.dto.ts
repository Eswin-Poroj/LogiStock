import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class RutaSolicitudDto {
  @IsUUID() bodega_id: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) pedido_ids: string[];
  @IsOptional() @IsString() salida_prevista?: string;
}
