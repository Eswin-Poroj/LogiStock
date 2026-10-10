import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CompletarPickingDto, EscaneoNuevoDto } from './picking.dto';

@Injectable()
export class PickingService {
  constructor(private readonly supabase: SupabaseService) {}

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('tareas_picking')
      .select('id, pedido_id, estado, picking_lineas(pedido_linea_id, cantidad_recogida, pedido_lineas(cantidad, productos(sku, nombre)))')
      .eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Tarea no encontrada');
    const fila: any = data;
    return {
      id: fila.id,
      pedido_id: fila.pedido_id,
      estado: fila.estado,
      lineas: (fila.picking_lineas ?? []).map((l: any) => ({
        pedido_linea_id: l.pedido_linea_id,
        cantidad_recogida: l.cantidad_recogida,
        cantidad: l.pedido_lineas.cantidad,
        sku: l.pedido_lineas.productos.sku,
        nombre: l.pedido_lineas.productos.nombre,
      })),
    };
  }

  async escanear(id: string, dto: EscaneoNuevoDto) {
    const tarea = await this.obtener(id);
    const linea = tarea.lineas.find((l: { sku: string; cantidad_recogida: number; cantidad: number; pedido_linea_id: string }) => l.sku === dto.sku);
    if (!linea) throw new ConflictException(`El SKU ${dto.sku} no está en la tarea`);
    const suma = dto.cantidad ?? 1;
    if (linea.cantidad_recogida + suma > linea.cantidad) {
      throw new ConflictException('La cantidad recogida supera lo pedido');
    }
    const upd = await this.supabase.db.from('picking_lineas')
      .update({ cantidad_recogida: linea.cantidad_recogida + suma })
      .eq('pedido_linea_id', linea.pedido_linea_id);
    if (upd.error) throw new BadRequestException(upd.error.message);
    if (tarea.estado === 'pendiente') {
      await this.supabase.db.from('tareas_picking').update({ estado: 'en_curso' }).eq('id', id);
    }
    return this.obtener(id);
  }

  async completar(id: string, dto: CompletarPickingDto) {
    const tarea = await this.obtener(id);
    const incompletas = tarea.lineas.filter((l: { cantidad_recogida: number; cantidad: number }) => l.cantidad_recogida < l.cantidad);
    if (incompletas.length && !dto.faltante) throw new ConflictException('Hay líneas pendientes');
    const estado = incompletas.length ? 'con_faltante' : 'completado';
    const upd = await this.supabase.db.from('tareas_picking').update({
      estado, completada_at: new Date().toISOString(),
    }).eq('id', id);
    if (upd.error) throw new BadRequestException(upd.error.message);
    return this.obtener(id);
  }
}
