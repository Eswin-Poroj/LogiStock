import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CompletarPickingDto, EscaneoNuevoDto, FiltroTareasDto } from './picking.dto';

const COLUMNAS = `id, pedido_id, estado, created_at,
  operario:usuarios(nombre),
  pedidos!inner(numero, estado, total, bodega_id, creado_por, clientes(nombre)),
  picking_lineas(pedido_linea_id, cantidad_recogida, pedido_lineas(cantidad, producto_id, productos(sku, nombre)))`;

interface LineaTarea {
  pedido_linea_id: string;
  producto_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  cantidad_recogida: number;
  ubicacion: string | null;
}

@Injectable()
export class PickingService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Tablero de CU-05. Las tareas de pedidos cancelados dejan de aparecer (CU-08 paso 6). */
  async listar(filtro: FiltroTareasDto) {
    let consulta = this.supabase.db.from('tareas_picking').select(COLUMNAS)
      .neq('pedidos.estado', 'cancelado')
      .order('created_at', { ascending: true });
    if (filtro.estado) consulta = consulta.eq('estado', filtro.estado);
    if (filtro.bodega_id) consulta = consulta.eq('pedidos.bodega_id', filtro.bodega_id);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return Promise.all((data ?? []).map((fila) => this.aRespuesta(fila)));
  }

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('tareas_picking').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Tarea no encontrada');
    return this.aRespuesta(data);
  }

  async escanear(id: string, dto: EscaneoNuevoDto, usuario: UsuarioActual) {
    const tarea = await this.obtener(id);
    if (tarea.estado === 'completado' || tarea.estado === 'con_faltante') throw new ConflictException('La tarea ya está cerrada');
    if (tarea.estado_pedido === 'cancelado') throw new ConflictException('El pedido fue cancelado');
    const linea = tarea.lineas.find((l) => l.sku === dto.sku);
    if (!linea) throw new ConflictException(`El SKU ${dto.sku} no está en la tarea`);
    const suma = dto.cantidad ?? 1;
    if (linea.cantidad_recogida + suma > linea.cantidad) {
      throw new ConflictException('La cantidad recogida supera lo pedido');
    }
    const upd = await this.supabase.db.from('picking_lineas')
      .update({ cantidad_recogida: linea.cantidad_recogida + suma })
      .eq('pedido_linea_id', linea.pedido_linea_id)
      .eq('cantidad_recogida', linea.cantidad_recogida);
    if (upd.error) throw new BadRequestException(upd.error.message);
    if (tarea.estado === 'pendiente') {
      // Primer escaneo válido: el operario toma la tarea, pasa a En curso y el pedido a En preparación.
      const t = await this.supabase.db.from('tareas_picking')
        .update({ estado: 'en_curso', operario_id: usuario.id }).eq('id', id).eq('estado', 'pendiente');
      if (t.error) throw new BadRequestException(t.error.message);
      const p = await this.supabase.db.from('pedidos')
        .update({ estado: 'en_preparacion' }).eq('id', tarea.pedido_id).eq('estado', 'creado');
      if (p.error) throw new ConflictException(p.error.message);
    }
    return this.obtener(id);
  }

  async completar(id: string, dto: CompletarPickingDto) {
    const tarea = await this.obtener(id);
    if (tarea.estado === 'completado' || tarea.estado === 'con_faltante') throw new ConflictException('La tarea ya está cerrada');
    const incompletas = tarea.lineas.filter((l) => l.cantidad_recogida < l.cantidad);
    if (incompletas.length && !dto.faltante) throw new ConflictException('Hay líneas pendientes');
    const estado = incompletas.length ? 'con_faltante' : 'completado';
    const upd = await this.supabase.db.from('tareas_picking').update({
      estado, completada_at: new Date().toISOString(),
    }).eq('id', id);
    if (upd.error) throw new BadRequestException(upd.error.message);
    if (estado === 'con_faltante') await this.avisarFaltante(tarea, incompletas);
    return this.obtener(id);
  }

  /** CU-05 E2: el asesor que creó el pedido recibe el aviso para ofrecer sustituto o backorder. */
  private async avisarFaltante(tarea: Awaited<ReturnType<PickingService['obtener']>>, incompletas: LineaTarea[]) {
    const detalle = incompletas.map((l) => `${l.sku} (${l.cantidad_recogida} de ${l.cantidad})`).join(', ');
    const { error } = await this.supabase.db.from('notificaciones').insert({
      usuario_id: tarea.creado_por,
      tipo: 'picking_faltante',
      pedido_id: tarea.pedido_id,
      mensaje: `El picking de ${tarea.numero_pedido} (${tarea.cliente}) quedó con faltante: ${detalle}. Ofrece un sustituto o backorder al cliente.`,
    });
    // El cierre ya quedó registrado; un fallo del aviso no debe deshacerlo, pero sí verse en el log.
    if (error) console.error('No se pudo crear el aviso de faltante', error.message);
  }

  private async aRespuesta(fila: any) {
    const lineas: LineaTarea[] = (fila.picking_lineas ?? []).map((l: any) => ({
      pedido_linea_id: l.pedido_linea_id,
      producto_id: l.pedido_lineas.producto_id,
      sku: l.pedido_lineas.productos.sku,
      nombre: l.pedido_lineas.productos.nombre,
      cantidad: l.pedido_lineas.cantidad,
      cantidad_recogida: l.cantidad_recogida,
      ubicacion: null,
    }));
    // La ubicación vive en stock (producto + bodega), no en la línea.
    if (lineas.length) {
      const { data } = await this.supabase.db.from('stock').select('producto_id, ubicacion')
        .eq('bodega_id', fila.pedidos.bodega_id).in('producto_id', lineas.map((l) => l.producto_id));
      const porProducto = new Map((data ?? []).map((s: any) => [s.producto_id, s.ubicacion]));
      for (const linea of lineas) linea.ubicacion = porProducto.get(linea.producto_id) ?? null;
    }
    return {
      id: fila.id as string,
      pedido_id: fila.pedido_id as string,
      numero_pedido: fila.pedidos.numero as string,
      cliente: (fila.pedidos.clientes?.nombre ?? '') as string,
      total: Number(fila.pedidos.total),
      estado: fila.estado as string,
      estado_pedido: fila.pedidos.estado as string,
      creado_por: fila.pedidos.creado_por as string,
      operario: (fila.operario?.nombre ?? null) as string | null,
      lineas,
    };
  }
}
