import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DespachoNuevoDto, RutaSolicitudDto } from './despachos.dto';
import { RutasClient } from './rutas.client';
import { CargaPedido, redondearKg, sugerirViajes } from './carga';

const COLUMNAS = `id, codigo, estado, distancia_km, duracion_min, salida_prevista, created_at,
  vehiculos(nombre, placa), conductores(nombre),
  despacho_paradas(id, orden, pedido_id, eta, entregada_at, pedidos(numero, clientes(nombre, direccion)))`;

interface ParadaDespacho {
  id: string;
  orden: number;
  pedido_id: string;
  numero_pedido: string;
  cliente: string;
  direccion: string;
  eta?: string;
  entregada_at?: string;
}

function aDespacho(fila: any) {
  const paradas: ParadaDespacho[] = (fila.despacho_paradas ?? [])
    .map((p: any) => ({
      id: p.id,
      orden: p.orden,
      pedido_id: p.pedido_id,
      numero_pedido: p.pedidos?.numero ?? '',
      cliente: p.pedidos?.clientes?.nombre ?? '',
      direccion: p.pedidos?.clientes?.direccion ?? '',
      eta: p.eta ?? undefined,
      entregada_at: p.entregada_at ?? undefined,
    }))
    .sort((a: ParadaDespacho, b: ParadaDespacho) => a.orden - b.orden);
  return {
    id: fila.id as string,
    codigo: fila.codigo as string,
    estado: fila.estado as string,
    vehiculo: (fila.vehiculos?.nombre ?? '') as string,
    placa: (fila.vehiculos?.placa ?? '') as string,
    conductor: (fila.conductores?.nombre ?? '') as string,
    distancia_km: fila.distancia_km != null ? Number(fila.distancia_km) : undefined,
    duracion_min: fila.duracion_min ?? undefined,
    salida_prevista: fila.salida_prevista ?? undefined,
    created_at: fila.created_at as string,
    paradas,
  };
}

/** Texto del aviso de CU-06 A2: dividir si se puede; si un pedido solo no cabe, otro vehículo. */
export function avisoSobrecarga(c: { carga_kg: number; capacidad_kg: number; viajes_sugeridos: unknown[]; pedidos_que_no_caben: string[] }) {
  const base = `La carga (${c.carga_kg} kg) supera la capacidad del vehículo (${c.capacidad_kg} kg).`;
  if (c.pedidos_que_no_caben.length) {
    return `${base} ${c.pedidos_que_no_caben.join(', ')} por sí solo no cabe: usa un vehículo de más capacidad o confirma la sobrecarga.`;
  }
  return `${base} Divide el despacho en ${c.viajes_sugeridos.length} viajes o confirma la sobrecarga.`;
}

@Injectable()
export class DespachosService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly rutas: RutasClient,
  ) {}

  async calcularRuta(dto: RutaSolicitudDto) {
    const puntos = await this.puntosDe(dto);
    const cruda = await this.rutas.calcular(puntos.map((p) => ({ lng: p.lng, lat: p.lat })));
    if (!cruda) throw new BadGatewayException('El motor de rutas no respondió');
    const salida = dto.salida_prevista ? Date.parse(dto.salida_prevista) : Date.now();
    const origen = puntos[0];
    const capacidad = dto.vehiculo_id ? await this.capacidad(dto.vehiculo_id, dto.pedido_ids) : null;
    return {
      ...(capacidad ?? {}),
      distancia_km: cruda.distancia_km,
      duracion_min: cruda.duracion_min,
      proveedor: cruda.proveedor,
      origen: { nombre: origen.cliente, direccion: origen.direccion, latitud: origen.lat, longitud: origen.lng },
      paradas: cruda.ordenPuntos.map((indicePunto, n) => ({
        orden: n + 1,
        pedido_id: puntos[indicePunto].pedidoId,
        cliente: puntos[indicePunto].cliente,
        direccion: puntos[indicePunto].direccion,
        latitud: puntos[indicePunto].lat,
        longitud: puntos[indicePunto].lng,
        eta: new Date(salida + cruda.segundosAcumulados[n] * 1000).toISOString(),
      })),
      trazo: cruda.trazo,
    };
  }

  async crear(dto: DespachoNuevoDto, usuario: UsuarioActual) {
    const db = this.supabase.db;
    const ids = dto.paradas.map((p) => p.pedido_id);
    const ya = await db.from('despacho_paradas').select('pedido_id').in('pedido_id', ids);
    if (ya.error) throw new BadRequestException(ya.error.message);
    if ((ya.data ?? []).length) throw new ConflictException('El pedido ya está asignado a otra ruta');
    await this.exigirPickingCompleto(ids);
    const capacidad = await this.capacidad(dto.vehiculo_id, ids);
    if (capacidad.excede_capacidad && !dto.aceptar_exceso) {
      throw new ConflictException({
        statusCode: 409,
        message: avisoSobrecarga(capacidad),
        ...capacidad,
      });
    }
    const codigo = `R-${Date.now().toString(36).toUpperCase()}`;
    const ins = await db.from('despachos').insert({
      codigo,
      vehiculo_id: dto.vehiculo_id,
      conductor_id: dto.conductor_id,
      bodega_id: dto.bodega_id,
      salida_prevista: dto.salida_prevista ?? null,
      distancia_km: dto.distancia_km ?? null,
      duracion_min: dto.duracion_min ?? null,
      creado_por: usuario.id,
    }).select('id').single();
    if (ins.error || !ins.data) throw new BadRequestException(ins.error?.message ?? 'No se pudo crear el despacho');
    for (const parada of dto.paradas) {
      const fila = await db.from('despacho_paradas').insert({
        despacho_id: ins.data.id,
        pedido_id: parada.pedido_id,
        orden: parada.orden,
        eta: parada.eta ?? null,
      });
      if (fila.error?.code === '23505') throw new ConflictException('El pedido ya está asignado a otra ruta');
      if (fila.error) throw new BadRequestException(fila.error.message);
      await this.marcarDespachado(parada.pedido_id, codigo, usuario);
    }
    return this.obtener(ins.data.id);
  }

  async listar(estado?: string) {
    let consulta = this.supabase.db.from('despachos').select(COLUMNAS).order('created_at', { ascending: false });
    if (estado) consulta = consulta.eq('estado', estado);
    const { data, error } = await consulta;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map(aDespacho);
  }

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('despachos').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Despacho no encontrado');
    return aDespacho(data);
  }

  /** CU-07 paso 1: el chofer inicia su ruta. Solo desde planificado. */
  async iniciar(id: string) {
    const despacho = await this.obtener(id);
    if (despacho.estado !== 'planificado') {
      throw new ConflictException(`El despacho está ${despacho.estado}; solo se inicia una ruta planificada`);
    }
    const upd = await this.supabase.db.from('despachos').update({ estado: 'en_ruta' }).eq('id', id).eq('estado', 'planificado');
    if (upd.error) throw new BadRequestException(upd.error.message);
    return this.obtener(id);
  }

  async entregar(despachoId: string, paradaId: string) {
    const despacho = await this.obtener(despachoId);
    const parada = despacho.paradas.find((p) => p.id === paradaId);
    if (!parada) throw new NotFoundException('Parada no encontrada');
    if (despacho.estado !== 'en_ruta') throw new ConflictException('Inicia la ruta antes de confirmar entregas');
    if (parada.entregada_at) throw new ConflictException('Parada ya entregada');
    const ped = await this.supabase.db.from('pedidos').update({ estado: 'entregado' }).eq('id', parada.pedido_id).eq('estado', 'despachado');
    if (ped.error) throw new ConflictException(ped.error.message);
    const marca = await this.supabase.db.from('despacho_paradas').update({
      entregada_at: new Date().toISOString(),
    }).eq('id', paradaId);
    if (marca.error) throw new BadRequestException(marca.error.message);
    const pendientes = despacho.paradas.filter((p) => p.id !== paradaId && !p.entregada_at);
    if (pendientes.length === 0) {
      await this.supabase.db.from('despachos').update({ estado: 'finalizado' }).eq('id', despachoId);
    }
    return this.obtener(despachoId);
  }

  async eliminar(id: string) {
    const despacho = await this.obtener(id);
    if (despacho.paradas.length) {
      throw new ConflictException('El despacho tiene pedidos asignados; queda como historial y no se puede eliminar.');
    }
    const { error } = await this.supabase.db.from('despachos').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  /** CU-06 A2: carga de los pedidos (unidades reservadas × peso) frente a la capacidad del vehículo. */
  private async capacidad(vehiculoId: string, pedidoIds: string[]) {
    const db = this.supabase.db;
    const { data: vehiculo, error } = await db.from('vehiculos').select('capacidad_kg').eq('id', vehiculoId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    const { data: pedidos, error: ePed } = await db.from('pedidos')
      .select('id, numero, pedido_lineas(cantidad, estado, productos(peso_kg))').in('id', pedidoIds);
    if (ePed) throw new BadRequestException(ePed.message);
    const cargas: CargaPedido[] = (pedidos ?? []).map((p: any) => ({
      pedido_id: p.id,
      numero: p.numero,
      kg: (p.pedido_lineas ?? []).filter((l: any) => l.estado === 'reservada')
        .reduce((suma: number, l: any) => suma + l.cantidad * Number(l.productos?.peso_kg ?? 0), 0),
    }));
    const carga = redondearKg(cargas.reduce((suma, c) => suma + c.kg, 0));
    const capacidadKg = Number(vehiculo.capacidad_kg);
    const excede = carga > capacidadKg;
    const sugerencia = excede ? sugerirViajes(cargas, capacidadKg) : { viajes: [], no_caben: [] };
    return {
      carga_kg: carga,
      capacidad_kg: capacidadKg,
      excede_capacidad: excede,
      viajes_sugeridos: sugerencia.viajes,
      pedidos_que_no_caben: sugerencia.no_caben,
    };
  }

  /** CU-06: solo se despachan pedidos en preparación cuyo picking quedó completado. */
  private async exigirPickingCompleto(pedidoIds: string[]) {
    const { data, error } = await this.supabase.db.from('pedidos')
      .select('id, numero, estado, tareas_picking(estado)').in('id', pedidoIds);
    if (error) throw new BadRequestException(error.message);
    const porId = new Map((data ?? []).map((p: any) => [p.id, p]));
    for (const id of pedidoIds) {
      const p: any = porId.get(id);
      if (!p) throw new NotFoundException(`Pedido ${id} no encontrado`);
      const tarea = Array.isArray(p.tareas_picking) ? p.tareas_picking[0] : p.tareas_picking;
      if (p.estado !== 'en_preparacion' || tarea?.estado !== 'completado') {
        throw new ConflictException(`El pedido ${p.numero} no tiene el picking completado`);
      }
    }
  }

  /** En preparación → Despachado, y el reservado de cada línea sale del inventario. */
  private async marcarDespachado(pedidoId: string, codigo: string, usuario: UsuarioActual) {
    const db = this.supabase.db;
    const fin = await db.from('pedidos').update({ estado: 'despachado' })
      .eq('id', pedidoId).eq('estado', 'en_preparacion').select('bodega_id, numero').maybeSingle();
    if (fin.error) throw new ConflictException(fin.error.message);
    if (!fin.data) throw new ConflictException('El pedido ya no está en preparación');
    const lineas = await db.from('pedido_lineas').select('producto_id, cantidad').eq('pedido_id', pedidoId).eq('estado', 'reservada');
    if (lineas.error) throw new BadRequestException(lineas.error.message);
    for (const linea of lineas.data ?? []) {
      const rpc = await db.rpc('despachar_stock', {
        p_producto: linea.producto_id, p_bodega: fin.data.bodega_id, p_cantidad: linea.cantidad,
        p_referencia: `${fin.data.numero} · ${codigo}`, p_usuario: usuario.id,
      });
      if (rpc.error) throw new ConflictException(rpc.error.message);
    }
  }

  private async puntosDe(dto: RutaSolicitudDto) {
    const db = this.supabase.db;
    const bodega = await db.from('bodegas').select('latitud, longitud, direccion, nombre').eq('id', dto.bodega_id).single();
    if (bodega.error || !bodega.data) throw new BadRequestException(bodega.error?.message ?? 'Bodega no encontrada');
    const pedidos = await db.from('pedidos').select('id, clientes(nombre, direccion, latitud, longitud)').in('id', dto.pedido_ids);
    if (pedidos.error) throw new BadRequestException(pedidos.error.message);
    const porId = new Map((pedidos.data ?? []).map((p: any) => [p.id, p]));
    const puntos: { lng: number; lat: number; pedidoId: string; cliente: string; direccion: string }[] = [{
      lng: Number(bodega.data.longitud), lat: Number(bodega.data.latitud),
      pedidoId: '', cliente: bodega.data.nombre, direccion: bodega.data.direccion ?? '',
    }];
    for (const id of dto.pedido_ids) {
      const p: any = porId.get(id);
      const c = p?.clientes;
      if (!p || c?.latitud == null || c?.longitud == null) {
        throw new BadRequestException(`Al cliente del pedido ${id} le falta latitud o longitud`);
      }
      puntos.push({ lng: Number(c.longitud), lat: Number(c.latitud), pedidoId: id, cliente: c.nombre, direccion: c.direccion ?? '' });
    }
    return puntos;
  }
}
