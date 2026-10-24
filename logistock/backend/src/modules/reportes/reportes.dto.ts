import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class PeriodoDto {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
}

export class ResumenDto extends PeriodoDto {
  @IsOptional() @IsUUID() bodega_id?: string;
}

export class MasVendidosDto extends PeriodoDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite?: number;
}

export class AlertasDto {
  @IsOptional() @IsUUID() bodega_id?: string;
}
