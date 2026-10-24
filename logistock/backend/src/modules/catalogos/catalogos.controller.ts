import { Body, Controller, Get, HttpException, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
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
  /** El SKU no se escribe: se genera como PREFIJO-0001 a partir de la categoría. */
  @IsString() @IsNotEmpty() categoria: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() unidad?: string;
  @IsNumber() @Min(0) precio_unitario: number;
  @IsOptional() @IsInt() @Min(0) stock_minimo?: number;
  /** Visión: catálogo por SKU con ubicación en bodega. Crea la fila de stock en 0 con esa ubicación. */
  @IsOptional() @IsUUID() bodega_id?: string;
  @IsOptional() @IsString() ubicacion?: string;
}

export class ProductoCambioDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsString() @IsNotEmpty() categoria?: string;
  @IsOptional() @IsString() unidad?: string;
  @IsOptional() @IsNumber() @Min(0) precio_unitario?: number;
  @IsOptional() @IsInt() @Min(0) stock_minimo?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsUUID() bodega_id?: string;
  @IsOptional() @IsString() ubicacion?: string;
}

export class SustitutosDto {
  @IsUUID() bodega_id: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cantidad?: number;
}

export class ProveedorNuevoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() correo?: string;
}

export class VehiculoNuevoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsString() @IsNotEmpty() placa: string;
  @IsInt() @Min(1) capacidad_kg: number;
}

export class ConductorNuevoDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() telefono?: string;
}

export class BodegaNuevaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() direccion?: string;
  /** Punto de salida de las rutas (CU-06): sin coordenadas no se puede calcular el recorrido. */
  @IsNumber() @Min(-90) @Max(90) latitud: number;
  @IsNumber() @Min(-180) @Max(180) longitud: number;
}

export class BodegaCambioDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitud?: number;
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class ActivoDto {
  @IsBoolean() activo: boolean;
}

/** "Ferretería" → "FER". Solo letras, sin tildes; si no alcanza, PRD. */
export function prefijoDe(categoria: string) {
  const letras = categoria.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  return letras.length >= 2 ? letras.slice(0, 3) : 'PRD';
}

/** Categoría = prefijo del SKU antes del primer guion (FER-0012 → FER). */
export function categoriaDe(sku: string) {
  const i = sku.indexOf('-');
  return i > 0 ? sku.slice(0, i) : sku;
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
  async productos(@Query('q') q?: string, @Query('pagina') pagina = 1, @Query('limite') limite = 20, @Query('incluir_inactivos') inactivos?: string) {
    const desde = (Number(pagina) - 1) * Number(limite);
    let consulta = this.supabase.db.from('productos').select('*').order('sku').range(desde, desde + Number(limite) - 1);
    if (inactivos !== 'true') consulta = consulta.eq('activo', true);
    if (q) consulta = consulta.or(`sku.ilike.%${q}%,nombre.ilike.%${q}%`);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  @Roles('administrador')
  @Post('productos')
  async crearProducto(@Body() dto: ProductoNuevoDto) {
    const { bodega_id, ubicacion, categoria, ...producto } = dto;
    const { data: sku, error: eSku } = await this.supabase.db.rpc('siguiente_sku', { p_prefijo: prefijoDe(categoria) });
    if (eSku) this.fallo(eSku);
    const { data, error } = await this.supabase.db.from('productos')
      .insert({ ...producto, sku, categoria: categoria.trim() }).select().single();
    if (error) this.fallo(error);
    // Fila de stock en 0 en cada bodega activa: el producto aparece en Inventario y en Pedidos
    // (como agotado) desde que se crea, antes de su primera entrada de mercancía.
    const { data: bodegas, error: eBod } = await this.supabase.db.from('bodegas').select('id').eq('activa', true);
    if (eBod) this.fallo(eBod);
    for (const bodega of bodegas ?? []) {
      await this.ubicar(data.id, bodega.id, bodega.id === bodega_id ? ubicacion : undefined, bodega.id !== bodega_id);
    }
    return data;
  }

  @Roles('administrador')
  @Patch('productos/:id')
  async cambiarProducto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProductoCambioDto) {
    const { bodega_id, ubicacion, ...cambios } = dto;
    if (Object.keys(cambios).length) {
      const { error } = await this.supabase.db.from('productos').update(cambios).eq('id', id);
      if (error) this.fallo(error);
    }
    if (bodega_id) await this.ubicar(id, bodega_id, ubicacion);
    const { data, error } = await this.supabase.db.from('productos').select('*').eq('id', id).maybeSingle();
    if (error) this.fallo(error);
    if (!data) throw new NotFoundException('Producto no encontrado');
    return data;
  }

  /**
   * CU-01 E1: sustitutos de un producto sin stock. Misma categoría (prefijo del SKU),
   * activos y con disponible suficiente en la bodega; primero los de más existencia.
   */
  @Get('productos/:id/sustitutos')
  async sustitutos(@Param('id', ParseUUIDPipe) id: string, @Query() dto: SustitutosDto) {
    const { data: base, error } = await this.supabase.db.from('productos').select('id, sku').eq('id', id).maybeSingle();
    if (error) this.fallo(error);
    if (!base) throw new NotFoundException('Producto no encontrado');
    const { data, error: eStock } = await this.supabase.db.from('stock')
      .select('disponible, productos!inner(id, sku, nombre, precio_unitario, activo)')
      .eq('bodega_id', dto.bodega_id).eq('productos.activo', true)
      .ilike('productos.sku', `${categoriaDe(base.sku)}-%`)
      .gte('disponible', dto.cantidad ?? 1)
      .order('disponible', { ascending: false }).limit(6);
    if (eStock) this.fallo(eStock);
    return (data ?? [])
      .filter((s: any) => s.productos.id !== id)
      .slice(0, 5)
      .map((s: any) => ({
        producto_id: s.productos.id, sku: s.productos.sku, nombre: s.productos.nombre,
        precio_unitario: Number(s.productos.precio_unitario), disponible: s.disponible,
      }));
  }

  @Get('proveedores')
  async proveedores() {
    const { data, error } = await this.supabase.db.from('proveedores').select('*').order('nombre');
    if (error) this.fallo(error);
    return data;
  }

  @Roles('operario_bodega')
  @Post('proveedores')
  async crearProveedor(@Body() dto: ProveedorNuevoDto) {
    const { data, error } = await this.supabase.db.from('proveedores').insert(dto).select().single();
    if (error) this.fallo(error);
    return data;
  }

  /** Crea o actualiza la fila de stock; con `soloCrear` no pisa la ubicación existente. */
  private async ubicar(productoId: string, bodegaId: string, ubicacion?: string, soloCrear = false) {
    const { error } = await this.supabase.db.from('stock').upsert(
      { producto_id: productoId, bodega_id: bodegaId, ubicacion: ubicacion || null },
      { onConflict: 'producto_id,bodega_id', ignoreDuplicates: soloCrear },
    );
    if (error) this.fallo(error);
  }

  @Get('bodegas')
  async bodegas(@Query('incluir_inactivas') inactivas?: string) {
    let consulta = this.supabase.db.from('bodegas').select('*').order('nombre');
    if (inactivas !== 'true') consulta = consulta.eq('activa', true);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  /** Visión: múltiples almacenes desde el día uno. Solo el administrador las da de alta. */
  @Roles('administrador')
  @Post('bodegas')
  async crearBodega(@Body() dto: BodegaNuevaDto) {
    const { data, error } = await this.supabase.db.from('bodegas').insert({ ...dto, activa: true }).select().single();
    if (error) this.fallo(error);
    // Cada producto activo nace con su fila de stock en 0 en la bodega nueva.
    const { data: productos, error: eProd } = await this.supabase.db.from('productos').select('id').eq('activo', true);
    if (eProd) this.fallo(eProd);
    if (productos?.length) {
      const { error: eStock } = await this.supabase.db.from('stock').upsert(
        productos.map((p) => ({ producto_id: p.id, bodega_id: data.id })),
        { onConflict: 'producto_id,bodega_id', ignoreDuplicates: true },
      );
      if (eStock) this.fallo(eStock);
    }
    return data;
  }

  @Roles('administrador')
  @Patch('bodegas/:id')
  async cambiarBodega(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BodegaCambioDto) {
    const { data, error } = await this.supabase.db.from('bodegas').update(dto).eq('id', id).select().maybeSingle();
    if (error) this.fallo(error);
    if (!data) throw new NotFoundException('Bodega no encontrada');
    return data;
  }

  @Get('vehiculos')
  async vehiculos(@Query('incluir_inactivos') inactivos?: string) {
    let consulta = this.supabase.db.from('vehiculos').select('*').order('nombre');
    if (inactivos !== 'true') consulta = consulta.eq('activo', true);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  /** Flota: la registra el administrador o el jefe de logística (despachador). */
  @Roles('despachador')
  @Post('vehiculos')
  async crearVehiculo(@Body() dto: VehiculoNuevoDto) {
    const { data, error } = await this.supabase.db.from('vehiculos')
      .insert({ ...dto, placa: dto.placa.trim().toUpperCase() }).select().single();
    if (error) this.fallo(error);
    return data;
  }

  @Roles('despachador')
  @Patch('vehiculos/:id')
  async activarVehiculo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActivoDto) {
    const { data, error } = await this.supabase.db.from('vehiculos').update({ activo: dto.activo }).eq('id', id).select().maybeSingle();
    if (error) this.fallo(error);
    if (!data) throw new NotFoundException('Vehículo no encontrado');
    return data;
  }

  @Get('conductores')
  async conductores(@Query('incluir_inactivos') inactivos?: string) {
    let consulta = this.supabase.db.from('conductores').select('*').order('nombre');
    if (inactivos !== 'true') consulta = consulta.eq('activo', true);
    const { data, error } = await consulta;
    if (error) this.fallo(error);
    return data;
  }

  @Roles('despachador')
  @Post('conductores')
  async crearConductor(@Body() dto: ConductorNuevoDto) {
    const { data, error } = await this.supabase.db.from('conductores').insert(dto).select().single();
    if (error) this.fallo(error);
    return data;
  }

  @Roles('despachador')
  @Patch('conductores/:id')
  async activarConductor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActivoDto) {
    const { data, error } = await this.supabase.db.from('conductores').update({ activo: dto.activo }).eq('id', id).select().maybeSingle();
    if (error) this.fallo(error);
    if (!data) throw new NotFoundException('Conductor no encontrado');
    return data;
  }
}
