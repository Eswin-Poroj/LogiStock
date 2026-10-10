import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class EscaneoNuevoDto {
  @IsString() sku: string;
  @IsOptional() @IsInt() @Min(1) cantidad?: number;
}

export class CompletarPickingDto {
  @IsOptional() @IsBoolean() faltante?: boolean;
  @IsOptional() @IsString() nota?: string;
}
