import { Body, Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Roles } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';

export class ClienteNuevoDto {
  @IsString() nombre: string;
  @IsString() nit: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() municipio?: string;
  @IsOptional() @IsNumber() latitud?: number;
  @IsOptional() @IsNumber() longitud?: number;
}

export class ProductoNuevoDto {
  @IsString() sku: string;
  @IsString() nombre: string;
  @IsOptional() @IsString() unidad?: string;
  @IsNumber() @Min(0) precio_unitario: number;
  @IsOptional() @IsNumber() @Min(0) stock_minimo?: number;
}

@ApiTags('Catálogos')
@ApiBearerAuth()
@Controller()
export class CatalogosController {
  constructor(private readonly supabase: SupabaseService) {}

  private fallo(error: { code?: string; message: string }): never {
    throw new HttpException(error.message, error.code === '23505' ? 409 : 400);
  }

  @Get('clientes')
  async clientes(@Query('q') q?: string, @Query('pagina') pagina = 1, @Query('limite') limite = 20) {
    const desde = (Number(pagina) - 1) * Number(limite);
    let consulta = this.supabase.db.from('clientes').select('*').order('nombre').range(desde, desde + Number(limite) - 1);
    if (q) consulta = consulta.or(`nombre.ilike.%${q}%,nit.ilike.%${q}%`);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  @Roles('asesor_ventas')
  @Post('clientes')
  async crearCliente(@Body() dto: ClienteNuevoDto) {
    const { data, error } = await this.supabase.db.from('clientes').insert(dto).select().single();
    if (error) this.fallo(error);
    return data;
  }

  @Get('productos')
  async productos(@Query('q') q?: string, @Query('pagina') pagina = 1, @Query('limite') limite = 20) {
    const desde = (Number(pagina) - 1) * Number(limite);
    let consulta = this.supabase.db.from('productos').select('*').eq('activo', true).order('sku').range(desde, desde + Number(limite) - 1);
    if (q) consulta = consulta.or(`sku.ilike.%${q}%,nombre.ilike.%${q}%`);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  @Roles('administrador')
  @Post('productos')
  async crearProducto(@Body() dto: ProductoNuevoDto) {
    const { data, error } = await this.supabase.db.from('productos').insert(dto).select().single();
    if (error) this.fallo(error);
    return data;
  }

  @Get('bodegas')
  async bodegas() {
    const { data, error } = await this.supabase.db.from('bodegas').select('*').eq('activa', true).order('nombre');
    if (error) this.fallo(error);
    return data;
  }

  @Get('vehiculos')
  async vehiculos() {
    const { data, error } = await this.supabase.db.from('vehiculos').select('*').eq('activo', true).order('nombre');
    if (error) this.fallo(error);
    return data;
  }

  @Get('conductores')
  async conductores() {
    const { data, error } = await this.supabase.db.from('conductores').select('*').eq('activo', true).order('nombre');
    if (error) this.fallo(error);
    return data;
  }
}
