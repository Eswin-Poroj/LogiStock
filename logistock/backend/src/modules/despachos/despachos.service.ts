import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { RutaSolicitudDto } from './despachos.dto';
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
    return {
      distancia_km: cruda.distancia_km,
      duracion_min: cruda.duracion_min,
      proveedor: cruda.proveedor,
      paradas: cruda.ordenPuntos.map((indicePunto, n) => ({
        orden: n + 1,
        pedido_id: puntos[indicePunto].pedidoId,
        cliente: puntos[indicePunto].cliente,
        direccion: puntos[indicePunto].direccion,
        eta: new Date(salida + cruda.segundosAcumulados[n] * 1000).toISOString(),
      })),
    };
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
