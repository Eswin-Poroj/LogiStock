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
    return {
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
    const codigo = `R-${Date.now().toString(36).toUpperCase()}`;
    const ins = await db.from('despachos').insert({
      codigo,
      vehiculo_id: dto.vehiculo_id,
      conductor_id: dto.conductor_id,
      bodega_id: dto.bodega_id,
      salida_prevista: dto.salida_prevista ?? null,
      creado_por: usuario.id,
    }).select('id').single();
    if (ins.error || !ins.data) throw new BadRequestException(ins.error?.message ?? 'No se pudo crear el despacho');
    for (const parada of dto.paradas) {
      await this.marcarDespachado(parada.pedido_id);
      const fila = await db.from('despacho_paradas').insert({
        despacho_id: ins.data.id,
        pedido_id: parada.pedido_id,
        orden: parada.orden,
        eta: parada.eta ?? null,
      });
      if (fila.error?.code === '23505') throw new ConflictException('El pedido ya está asignado a otra ruta');
      if (fila.error) throw new BadRequestException(fila.error.message);
    }
    return this.obtener(ins.data.id);
  }

  async obtener(id: string) {
    const { data, error } = await this.supabase.db.from('despachos')
      .select('id, codigo, estado, distancia_km, duracion_min, vehiculos(nombre), conductores(nombre), despacho_paradas(id, orden, pedido_id, eta, entregada_at)')
      .eq('id', id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Despacho no encontrado');
    const fila: any = data;
    return {
      id: fila.id,
      codigo: fila.codigo,
      estado: fila.estado,
      vehiculo: fila.vehiculos?.nombre ?? '',
      conductor: fila.conductores?.nombre ?? '',
      distancia_km: fila.distancia_km != null ? Number(fila.distancia_km) : undefined,
      duracion_min: fila.duracion_min ?? undefined,
      paradas: (fila.despacho_paradas ?? []).map((p: any) => ({
        id: p.id,
        orden: p.orden,
        pedido_id: p.pedido_id,
        eta: p.eta ?? undefined,
        entregada_at: p.entregada_at ?? undefined,
      })),
    };
  }

  async entregar(despachoId: string, paradaId: string) {
    const despacho = await this.obtener(despachoId);
    const parada = (despacho.paradas ?? []).find((p: { id: string }) => p.id === paradaId);
    if (!parada) throw new NotFoundException('Parada no encontrada');
    if (parada.entregada_at) throw new ConflictException('Parada ya entregada');
    const ped = await this.supabase.db.from('pedidos').update({ estado: 'entregado' }).eq('id', parada.pedido_id).eq('estado', 'despachado');
    if (ped.error) throw new ConflictException(ped.error.message);
    const marca = await this.supabase.db.from('despacho_paradas').update({
      entregada_at: new Date().toISOString(),
    }).eq('id', paradaId);
    if (marca.error) throw new BadRequestException(marca.error.message);
    const pendientes = (despacho.paradas ?? []).filter((p: { id: string; entregada_at?: string }) => p.id !== paradaId && !p.entregada_at);
    if (pendientes.length === 0) {
      await this.supabase.db.from('despachos').update({ estado: 'finalizado' }).eq('id', despachoId);
    }
    return this.obtener(despachoId);
  }

  private async marcarDespachado(pedidoId: string) {
    const db = this.supabase.db;
    const { data, error } = await db.from('pedidos').select('estado').eq('id', pedidoId).single();
    if (error || !data) throw new NotFoundException('Pedido no encontrado');
    if (data.estado === 'creado') {
      const paso = await db.from('pedidos').update({ estado: 'en_preparacion' }).eq('id', pedidoId).eq('estado', 'creado');
      if (paso.error) throw new ConflictException(paso.error.message);
    }
    const actual = data.estado === 'creado' ? 'en_preparacion' : data.estado;
    if (actual === 'en_preparacion') {
      const fin = await db.from('pedidos').update({ estado: 'despachado' }).eq('id', pedidoId).eq('estado', 'en_preparacion');
      if (fin.error) throw new ConflictException(fin.error.message);
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
