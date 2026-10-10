import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { COLA_PICKING } from '../pedidos/pedidos.module';

/** Worker de BullMQ: crea la tarea de picking y sus líneas al confirmarse un pedido. */
@Processor(COLA_PICKING)
export class PickingProcessor extends WorkerHost {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async process(job: Job<{ pedido_id: string }>) {
    const db = this.supabase.db;
    const { pedido_id } = job.data;

    // Idempotente: pedido_id es único en tareas_picking, un reintento no duplica
    const { data: tarea, error } = await db
      .from('tareas_picking')
      .upsert({ pedido_id }, { onConflict: 'pedido_id', ignoreDuplicates: true })
      .select('id').maybeSingle();
    if (error) throw error;
    if (!tarea) return; // ya existía

    const { data: lineas } = await db
      .from('pedido_lineas').select('id').eq('pedido_id', pedido_id).eq('estado', 'reservada');
    await db.from('picking_lineas').insert((lineas ?? []).map((l) => ({ tarea_id: tarea.id, pedido_linea_id: l.id })));
  }
}
