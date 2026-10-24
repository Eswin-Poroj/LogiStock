import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AjusteNuevoDto, EntradaNuevaDto } from './inventario.dto';

export type EstadoStock = 'normal' | 'stock_bajo' | 'agotado';

@Injectable()
export class InventarioService {
  constructor(private readonly supabase: SupabaseService) {}

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
    // La función repite la condición dentro del UPDATE: si otro movimiento ganó la carrera, devuelve null.
    const { data, error } = await this.supabase.db.rpc('ajustar_stock', {
      p_producto: dto.producto_id, p_bodega: dto.bodega_id, p_cantidad: dto.cantidad,
      p_motivo: dto.motivo, p_usuario: usuario.id,
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
