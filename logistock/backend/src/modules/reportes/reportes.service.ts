import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  DespachoFila, PedidoFila, Periodo, StockFila,
  alertasStock, finExclusivo, masVendidos, periodoDe, resumen,
} from './reportes.calculos';
import { AlertasDto, MasVendidosDto, ResumenDto } from './reportes.dto';

@Injectable()
export class ReportesService {
  constructor(private readonly supabase: SupabaseService) {}

  async resumen(dto: ResumenDto) {
    const periodo = periodoDe(dto.desde, dto.hasta);
    const [despachos, pedidos, stock] = await Promise.all([
      this.despachos(periodo, dto.bodega_id),
      this.pedidos(periodo, dto.bodega_id),
      this.stock(dto.bodega_id),
    ]);
    return resumen(periodo, despachos, pedidos, stock);
  }

  async masVendidos(dto: MasVendidosDto) {
    return masVendidos(await this.pedidos(periodoDe(dto.desde, dto.hasta)), dto.limite ?? 20);
  }

  async alertas(dto: AlertasDto) {
    return alertasStock(await this.stock(dto.bodega_id));
  }

  private async despachos(periodo: Periodo, bodegaId?: string): Promise<DespachoFila[]> {
    let consulta = this.supabase.db.from('despachos')
      .select('created_at, despacho_paradas(eta, entregada_at)')
      .neq('estado', 'cancelado')
      .gte('created_at', periodo.desde).lt('created_at', finExclusivo(periodo));
    if (bodegaId) consulta = consulta.eq('bodega_id', bodegaId);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((d: any) => ({ created_at: d.created_at, paradas: d.despacho_paradas ?? [] }));
  }

  private async pedidos(periodo: Periodo, bodegaId?: string): Promise<PedidoFila[]> {
    let consulta = this.supabase.db.from('pedidos')
      .select('estado, pedido_lineas(cantidad, estado, productos(sku, nombre))')
      .gte('created_at', periodo.desde).lt('created_at', finExclusivo(periodo));
    if (bodegaId) consulta = consulta.eq('bodega_id', bodegaId);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((p: any) => ({
      estado: p.estado,
      lineas: (p.pedido_lineas ?? []).map((l: any) => ({
        cantidad: l.cantidad, estado: l.estado, sku: l.productos?.sku ?? '', nombre: l.productos?.nombre ?? '',
      })),
    }));
  }

  private async stock(bodegaId?: string): Promise<StockFila[]> {
    let consulta = this.supabase.db.from('stock')
      .select('disponible, productos!inner(sku, nombre, stock_minimo, activo)')
      .eq('productos.activo', true);
    if (bodegaId) consulta = consulta.eq('bodega_id', bodegaId);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((s: any) => ({
      sku: s.productos.sku, nombre: s.productos.nombre, disponible: s.disponible, stock_minimo: s.productos.stock_minimo,
    }));
  }
}
