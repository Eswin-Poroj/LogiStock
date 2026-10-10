import { HttpException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';

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
}
