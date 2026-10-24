import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CotizacionNuevaDto } from './cotizaciones.dto';

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Cotización: los precios y el total quedan guardados, pero no se reserva stock. */
@Injectable()
export class CotizacionesService {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}

  async crear(dto: CotizacionNuevaDto, usuario: UsuarioActual) {
    const db = this.supabase.db;
    const cantidades = new Map<string, number>();
    for (const l of dto.lineas) cantidades.set(l.producto_id, (cantidades.get(l.producto_id) ?? 0) + l.cantidad);
    const { data: productos, error } = await db.from('productos')
      .select('id, precio_unitario').in('id', [...cantidades.keys()]).eq('activo', true);
    if (error) throw new BadRequestException(error.message);
    const faltan = [...cantidades.keys()].filter((id) => !(productos ?? []).some((p) => p.id === id));
    if (faltan.length) throw new BadRequestException(`Hay productos inexistentes o inactivos: ${faltan.join(', ')}`);
    const subtotal = round2((productos ?? []).reduce((a, p) => a + cantidades.get(p.id)! * Number(p.precio_unitario), 0));
    const iva = round2((subtotal * this.config.get<number>('ivaPorcentaje', 12)) / 100);
    const ins = await db.from('cotizaciones').insert({
      cliente_id: dto.cliente_id, bodega_id: dto.bodega_id, subtotal, iva, total: round2(subtotal + iva), creado_por: usuario.id,
    }).select('id').single();
    if (ins.error || !ins.data) throw new BadRequestException(ins.error?.message ?? 'No se pudo guardar la cotización');
    const lineas = await db.from('cotizacion_lineas').insert((productos ?? []).map((p) => ({
      cotizacion_id: ins.data.id, producto_id: p.id, cantidad: cantidades.get(p.id), precio_unitario: p.precio_unitario,
    })));
    if (lineas.error) {
      await db.from('cotizaciones').delete().eq('id', ins.data.id);
      throw new BadRequestException(lineas.error.message);
    }
    return this.obtener(ins.data.id);
  }

  async listar(clienteId?: string) {
    let consulta = this.supabase.db.from('cotizaciones')
      .select('id, numero, total, created_at, pedido_id, clientes(nombre)')
      .order('created_at', { ascending: false }).limit(50);
    if (clienteId) consulta = consulta.eq('cliente_id', clienteId);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id, numero: c.numero, cliente: c.clientes?.nombre ?? '', total: Number(c.total),
      created_at: c.created_at, pedido_id: c.pedido_id,
    }));
  }

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('cotizaciones')
      .select('id, numero, cliente_id, bodega_id, subtotal, iva, total, pedido_id, created_at, clientes(nombre, nit, direccion), bodegas(nombre), autor:usuarios!cotizaciones_creado_por_fkey(nombre), cotizacion_lineas(producto_id, cantidad, precio_unitario, subtotal, productos(sku, nombre))')
      .eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Cotización no encontrada');
    const c: any = data;
    return {
      id: c.id, numero: c.numero, cliente_id: c.cliente_id, cliente: c.clientes?.nombre ?? '', bodega_id: c.bodega_id,
      cliente_nit: c.clientes?.nit ?? '', cliente_direccion: c.clientes?.direccion ?? '', bodega: c.bodegas?.nombre ?? '', asesor: c.autor?.nombre ?? '',
      subtotal: Number(c.subtotal), iva: Number(c.iva), total: Number(c.total), pedido_id: c.pedido_id, created_at: c.created_at,
      lineas: (c.cotizacion_lineas ?? []).map((l: any) => ({
        producto_id: l.producto_id, sku: l.productos.sku, nombre: l.productos.nombre,
        cantidad: l.cantidad, precio_unitario: Number(l.precio_unitario), subtotal: Number(l.subtotal),
      })),
    };
  }

  async eliminar(id: string) {
    const { data, error } = await this.supabase.db.from('cotizaciones').delete().eq('id', id).select('id');
    if (error) throw new BadRequestException(error.message);
    if (!data?.length) throw new NotFoundException('Cotización no encontrada');
  }
}
