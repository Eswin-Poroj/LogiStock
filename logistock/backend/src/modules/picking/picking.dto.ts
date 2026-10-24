import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class EscaneoNuevoDto {
  @IsString() sku: string;
  @IsOptional() @IsInt() @Min(1) cantidad?: number;
}

export class CompletarPickingDto {
  @IsOptional() @IsBoolean() faltante?: boolean;
  @IsOptional() @IsString() nota?: string;
}

export class FiltroTareasDto {
  @IsOptional() @IsUUID() bodega_id?: string;
  @IsOptional() @IsIn(['pendiente', 'en_curso', 'completado', 'con_faltante']) estado?: string;
}
