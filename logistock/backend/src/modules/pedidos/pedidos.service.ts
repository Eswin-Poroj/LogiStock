import {
  BadRequestException, ConflictException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { LockService } from '../../common/redis/lock.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PedidoNuevoDto } from './pedidos.dto';
import { COLA_PICKING } from './cola-picking';

interface LineaResuelta {
  producto_id: string;
  sku: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  reservada: boolean;
  disponible: number;
}

@Injectable()
export class PedidosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly locks: LockService,
    private readonly config: ConfigService,
    @InjectQueue(COLA_PICKING) private readonly colaPicking: Queue,
  ) {}

  /**
   * CU-01 + CU-02. Pasos:
   *  1. Toma el lock distribuido de cada SKU+bodega (Redlock, llaves ordenadas).
   *  2. Crea el pedido y reserva cada línea con la función SQL atómica reservar_stock().
   *  3. Según la política de faltantes, rechaza el pedido o deja esas líneas en backorder.
   *  4. Calcula totales, guarda las líneas y encola la tarea de picking (BullMQ).
   * Si algo falla se compensa liberando lo ya reservado (no hay transacciones en supabase-js).
   */
  async crear(dto: PedidoNuevoDto, usuario: UsuarioActual) {
    const politica = dto.politica_faltantes ?? 'rechazar';
    const db = this.supabase.db;

    // Se agrupan cantidades repetidas del mismo producto
    const pedidas = new Map<string, number>();
    for (const l of dto.lineas) pedidas.set(l.producto_id, (pedidas.get(l.producto_id) ?? 0) + l.cantidad);

    const { data: productos, error: eProd } = await db
      .from('productos').select('id, sku, nombre, precio_unitario').in('id', [...pedidas.keys()]).eq('activo', true);
    if (eProd) throw new BadRequestException(eProd.message);
    if ((productos?.length ?? 0) !== pedidas.size) throw new BadRequestException('Hay productos inexistentes o inactivos');

    const llaves = [...pedidas.keys()].map((p) => LockService.llaveStock(p, dto.bodega_id));

    return this.locks.conLocks(llaves, async () => {
      const { data: pedido, error: ePed } = await db
        .from('pedidos')
        .insert({ cliente_id: dto.cliente_id, bodega_id: dto.bodega_id, creado_por: usuario.id })
        .select('id, numero').single();
      if (ePed || !pedido) throw new BadRequestException(ePed?.message ?? 'No se pudo crear el pedido');

      const resueltas: LineaResuelta[] = [];
      try {
        for (const p of productos!) {
          const cantidad = pedidas.get(p.id)!;
          const { data: ok, error } = await db.rpc('reservar_stock', {
            p_producto: p.id, p_bodega: dto.bodega_id, p_cantidad: cantidad,
            p_referencia: pedido.numero, p_usuario: usuario.id,
          });
          if (error) throw new HttpException(error.message, 400);
          let disponible = 0;
          if (!ok) {
            const { data: s } = await db.from('stock').select('disponible')
              .eq('producto_id', p.id).eq('bodega_id', dto.bodega_id).maybeSingle();
            disponible = s?.disponible ?? 0;
          }
          resueltas.push({
            producto_id: p.id, sku: p.sku, nombre: p.nombre, cantidad,
            precio_unitario: Number(p.precio_unitario), reservada: !!ok, disponible,
          });
        }

        const sinStock = resueltas.filter((l) => !l.reservada);
        const conStock = resueltas.filter((l) => l.reservada);
        if (sinStock.length && (politica === 'rechazar' || conStock.length === 0)) {
          throw new ConflictException({
            statusCode: 409,
            message: 'Stock insuficiente',
            lineas_sin_stock: sinStock.map((l) => ({
              producto_id: l.producto_id, sku: l.sku, solicitado: l.cantidad, disponible: l.disponible,
            })),
          });
        }

        // Totales solo con líneas reservadas
        const subtotal = round2(conStock.reduce((a, l) => a + l.cantidad * l.precio_unitario, 0));
        const iva = round2((subtotal * this.config.get<number>('ivaPorcentaje', 12)) / 100);
        const total = round2(subtotal + iva);

        const { error: eLin } = await db.from('pedido_lineas').insert(
          resueltas.map((l) => ({
            pedido_id: pedido.id, producto_id: l.producto_id, cantidad: l.cantidad,
            precio_unitario: l.precio_unitario, estado: l.reservada ? 'reservada' : 'backorder',
          })),
        );
        if (eLin) throw new BadRequestException(eLin.message);
        await db.from('pedidos').update({ subtotal, iva, total }).eq('id', pedido.id);

        await this.colaPicking.add('crear-tarea', { pedido_id: pedido.id }, {
          attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true,
        });
      } catch (err) {
        await this.compensar(pedido.id, pedido.numero, dto.bodega_id, resueltas.filter((l) => l.reservada), usuario.id);
        throw err;
      }
      return this.obtener(pedido.id);
    });
  }

  /** Libera lo reservado y elimina el pedido cuando la creación no se completó. */
  private async compensar(pedidoId: string, numero: string, bodegaId: string, reservadas: LineaResuelta[], usuarioId: string) {
    for (const l of reservadas) {
      await this.supabase.db.rpc('liberar_stock', {
        p_producto: l.producto_id, p_bodega: bodegaId, p_cantidad: l.cantidad,
        p_referencia: numero, p_usuario: usuarioId,
      });
    }
    await this.supabase.db.from('pedidos').delete().eq('id', pedidoId);
  }

  async listar(estado?: string, clienteId?: string, pagina = 1, limite = 20) {
    const desde = (pagina - 1) * limite;
    let q = this.supabase.db.from('pedidos')
      .select('id, numero, estado, total, created_at, clientes(nombre)')
      .order('created_at', { ascending: false }).range(desde, desde + limite - 1);
    if (estado) q = q.eq('estado', estado);
    if (clienteId) q = q.eq('cliente_id', clienteId);
    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((p: any) => ({ id: p.id, numero: p.numero, cliente: p.clientes?.nombre, estado: p.estado, total: p.total, created_at: p.created_at }));
  }

  async obtener(id: string) {
    const { data, error } = await this.supabase.db
      .from('pedidos')
      .select('id, numero, bodega_id, estado, subtotal, iva, total, created_at, clientes(nombre), pedido_lineas(id, producto_id, cantidad, precio_unitario, subtotal, estado, productos(sku, nombre))')
      .eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Pedido no encontrado');
    const p: any = data;
    return {
      id: p.id, numero: p.numero, cliente: p.clientes?.nombre, bodega_id: p.bodega_id, estado: p.estado,
      subtotal: p.subtotal, iva: p.iva, total: p.total, created_at: p.created_at,
      lineas: p.pedido_lineas.map((l: any) => ({
        id: l.id, producto_id: l.producto_id, sku: l.productos.sku, nombre: l.productos.nombre,
        cantidad: l.cantidad, precio_unitario: l.precio_unitario, subtotal: l.subtotal, estado: l.estado,
      })),
    };
  }

  /** Cancela y libera el stock reservado. Solo Creado o En preparación. */
  async cancelar(id: string, usuario: UsuarioActual) {
    const pedido = await this.obtener(id);
    if (!['creado', 'en_preparacion'].includes(pedido.estado)) {
      throw new ConflictException(`No se puede cancelar un pedido en estado ${pedido.estado}`);
    }
    const llaves = pedido.lineas.map((l: any) => LockService.llaveStock(l.producto_id, pedido.bodega_id));
    return this.locks.conLocks(llaves, async () => {
      for (const l of pedido.lineas.filter((x: any) => x.estado === 'reservada')) {
        await this.supabase.db.rpc('liberar_stock', {
          p_producto: l.producto_id, p_bodega: pedido.bodega_id, p_cantidad: l.cantidad,
          p_referencia: pedido.numero, p_usuario: usuario.id,
        });
      }
      const { error } = await this.supabase.db.from('pedidos').update({ estado: 'cancelado' }).eq('id', id);
      if (error) throw new ConflictException(error.message);
      return this.obtener(id);
    });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
