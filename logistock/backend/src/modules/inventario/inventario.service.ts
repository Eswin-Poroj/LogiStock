import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AjusteNuevoDto, EntradaNuevaDto } from './inventario.dto';

export type EstadoStock = 'normal' | 'stock_bajo' | 'agotado';

/** CU-04 A1: el ajuste mueve más que el porcentaje permitido del disponible actual. */
export function requiereAprobacion(cantidad: number, disponible: number, maximoPct: number): boolean {
  return Math.abs(cantidad) > (disponible * maximoPct) / 100;
}

@Injectable()
export class InventarioService {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}

  /** Existencias por bodega con totales (RF-01). */
  async listar(bodegaId: string, q?: string, estado?: EstadoStock) {
    const { data, error } = await this.supabase.db
      .from('stock')
      .select('producto_id, ubicacion, disponible, reservado, en_transito, danado, productos!inner(sku, nombre, stock_minimo)')
      .eq('bodega_id', bodegaId);
    if (error) throw new HttpException(error.message, 400);

    let items = (data ?? []).map((s: any) => ({
      producto_id: s.producto_id,
      sku: s.productos.sku,
      nombre: s.productos.nombre,
      ubicacion: s.ubicacion,
      disponible: s.disponible,
      reservado: s.reservado,
      en_transito: s.en_transito,
      danado: s.danado,
      estado: (s.disponible === 0 ? 'agotado' : s.disponible <= s.productos.stock_minimo ? 'stock_bajo' : 'normal') as EstadoStock,
    }));
    if (q) items = items.filter((i) => `${i.sku} ${i.nombre}`.toLowerCase().includes(q.toLowerCase()));
    if (estado) items = items.filter((i) => i.estado === estado);

    const suma = (k: 'disponible' | 'reservado' | 'en_transito' | 'danado') => items.reduce((a, i) => a + i[k], 0);
    return {
      totales: { disponible: suma('disponible'), reservado: suma('reservado'), en_transito: suma('en_transito'), danado: suma('danado') },
      items,
    };
  }

  async movimientos(productoId: string, bodegaId: string, limite = 20) {
    const { data, error } = await this.supabase.db
      .from('movimientos_stock')
      .select('*')
      .eq('producto_id', productoId)
      .eq('bodega_id', bodegaId)
      .order('created_at', { ascending: false })
      .limit(limite);
    if (error) throw new HttpException(error.message, 400);
    return data;
  }

  async registrarEntrada(dto: EntradaNuevaDto, usuario: UsuarioActual) {
    const codigo = `OC-${Date.now()}`;
    const db = this.supabase.db;
    const { data: recepcion, error } = await db.from('recepciones').insert({
      codigo,
      proveedor_id: dto.proveedor_id,
      bodega_id: dto.bodega_id,
      estado: 'recibida',
      recibida_por: usuario.id,
      recibida_at: new Date().toISOString(),
    }).select('id, codigo, estado, created_at').single();
    if (error || !recepcion) throw new BadRequestException(error?.message ?? 'No se pudo crear la recepción');
    for (const linea of dto.lineas) {
      const ins = await db.from('recepcion_lineas').insert({
        recepcion_id: recepcion.id, producto_id: linea.producto_id, cantidad: linea.cantidad,
      });
      if (ins.error) throw new BadRequestException(ins.error.message);
      const rpc = await db.rpc('registrar_entrada', {
        p_producto: linea.producto_id, p_bodega: dto.bodega_id, p_cantidad: linea.cantidad,
        p_referencia: recepcion.codigo, p_usuario: usuario.id,
      });
      if (rpc.error) throw new BadRequestException(rpc.error.message);
    }
    return recepcion;
  }

  async registrarAjuste(dto: AjusteNuevoDto, usuario: UsuarioActual) {
    if (dto.tipo === 'danio') return this.registrarDanio(dto, usuario);
    if (dto.cantidad === 0) throw new BadRequestException('La cantidad del ajuste debe ser distinta de cero');
    const stock = await this.leerStockObligatorio(dto.producto_id, dto.bodega_id);
    if (stock.disponible + dto.cantidad < 0) {
      throw new ConflictException('El ajuste dejaría el stock negativo');
    }
    // CU-04 A1: un ajuste mayor al porcentaje permitido del disponible espera la aprobación del administrador.
    if (usuario.rol !== 'administrador' && requiereAprobacion(dto.cantidad, stock.disponible, this.config.get<number>('ajusteMaxPct', 20))) {
      const { data, error } = await this.supabase.db.from('ajustes_pendientes').insert({
        producto_id: dto.producto_id, bodega_id: dto.bodega_id, cantidad: dto.cantidad, motivo: dto.motivo, solicitado_por: usuario.id,
      }).select('id, producto_id, bodega_id, cantidad, motivo, estado, created_at').single();
      if (error || !data) throw new BadRequestException(error?.message ?? 'No se pudo registrar la solicitud');
      return { ...data, pendiente: true };
    }
    return this.aplicarAjuste(dto.producto_id, dto.bodega_id, dto.cantidad, dto.motivo, usuario.id);
  }

  async ajustesPendientes(estado = 'pendiente') {
    const { data, error } = await this.supabase.db.from('ajustes_pendientes')
      .select('id, cantidad, motivo, estado, created_at, revisado_at, producto_id, bodega_id, productos(sku, nombre), bodegas(nombre), solicitante:usuarios!ajustes_pendientes_solicitado_por_fkey(nombre), revisor:usuarios!ajustes_pendientes_revisado_por_fkey(nombre)')
      .eq('estado', estado).order('created_at', { ascending: false }).limit(100);
    if (error) throw new BadRequestException(error.message);
    const ids = (data ?? []).map((a: any) => a.producto_id);
    const { data: stock } = ids.length
      ? await this.supabase.db.from('stock').select('producto_id, bodega_id, disponible').in('producto_id', ids)
      : { data: [] as { producto_id: string; bodega_id: string; disponible: number }[] };
    return (data ?? []).map((a: any) => ({
      id: a.id, cantidad: a.cantidad, motivo: a.motivo, estado: a.estado, created_at: a.created_at, revisado_at: a.revisado_at,
      producto_id: a.producto_id, bodega_id: a.bodega_id, sku: a.productos?.sku, nombre: a.productos?.nombre, bodega: a.bodegas?.nombre,
      solicitado_por: a.solicitante?.nombre ?? '', revisado_por: a.revisor?.nombre ?? null,
      disponible: (stock ?? []).find((s) => s.producto_id === a.producto_id && s.bodega_id === a.bodega_id)?.disponible ?? 0,
    }));
  }

  /** El administrador aprueba: se aplica con la misma regla de no dejar negativo. */
  async resolverAjuste(id: string, aprobar: boolean, usuario: UsuarioActual) {
    const { data: solicitud, error } = await this.supabase.db.from('ajustes_pendientes').select('*').eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estado !== 'pendiente') throw new ConflictException(`La solicitud ya fue ${solicitud.estado === 'aprobado' ? 'aprobada' : 'rechazada'}`);
    let movimientoId: string | null = null;
    if (aprobar) {
      const mov = await this.aplicarAjuste(solicitud.producto_id, solicitud.bodega_id, solicitud.cantidad, `${solicitud.motivo} · aprobado por ${usuario.nombre}`, solicitud.solicitado_por);
      movimientoId = (mov as { id: string }).id;
    }
    const { data, error: eUpd } = await this.supabase.db.from('ajustes_pendientes').update({
      estado: aprobar ? 'aprobado' : 'rechazado', revisado_por: usuario.id, revisado_at: new Date().toISOString(), movimiento_id: movimientoId,
    }).eq('id', id).eq('estado', 'pendiente').select('id, estado').maybeSingle();
    if (eUpd) throw new BadRequestException(eUpd.message);
    if (!data) throw new ConflictException('Otro administrador ya resolvió la solicitud');
    return data;
  }

  private async aplicarAjuste(productoId: string, bodegaId: string, cantidad: number, motivo: string, usuarioId: string) {
    // La función repite la condición dentro del UPDATE: si otro movimiento ganó la carrera, devuelve null.
    const { data, error } = await this.supabase.db.rpc('ajustar_stock', {
      p_producto: productoId, p_bodega: bodegaId, p_cantidad: cantidad,
      p_motivo: motivo, p_usuario: usuarioId,
    });
    if (error) throw new BadRequestException(error.message);
    if (!data || !(data as { id?: string }).id) throw new ConflictException('El ajuste dejaría el stock negativo');
    return data;
  }

  private async leerStockObligatorio(productoId: string, bodegaId: string) {
    const { data, error } = await this.supabase.db.from('stock')
      .select('id, disponible, reservado, danado')
      .eq('producto_id', productoId).eq('bodega_id', bodegaId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('No hay fila de stock');
    return data;
  }

  private async registrarDanio(dto: AjusteNuevoDto, usuario: UsuarioActual) {
    const unidades = Math.abs(dto.cantidad);
    if (unidades === 0) throw new BadRequestException('La cantidad de daño debe ser distinta de cero');
    const stock = await this.leerStockObligatorio(dto.producto_id, dto.bodega_id);
    if (stock.disponible < unidades) throw new ConflictException('No hay suficiente disponible para registrar el daño');
    const { data: actualizado, error } = await this.supabase.db.from('stock').update({
      disponible: stock.disponible - unidades,
      danado: stock.danado + unidades,
      updated_at: new Date().toISOString(),
    }).eq('id', stock.id).gte('disponible', unidades).select('disponible, danado').maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!actualizado) throw new ConflictException('No hay suficiente disponible para registrar el daño');
    const mov = await this.supabase.db.from('movimientos_stock').insert({
      producto_id: dto.producto_id, bodega_id: dto.bodega_id, tipo: 'danio',
      cantidad: -unidades, referencia: dto.motivo, usuario_id: usuario.id,
    }).select('*').single();
    if (mov.error || !mov.data) throw new BadRequestException(mov.error?.message ?? 'No se pudo registrar el movimiento');
    return mov.data;
  }
}
