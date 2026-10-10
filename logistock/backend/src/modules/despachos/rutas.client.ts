import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RutaCruda {
  proveedor: 'osrm' | 'google';
  distancia_km: number;
  duracion_min: number;
  ordenPuntos: number[];
  segundosAcumulados: number[];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class RutasClient {
  constructor(private readonly config: ConfigService) {}

  async calcular(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    return (await this.osrm(puntos)) ?? (await this.google(puntos));
  }

  private async osrm(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    const base = this.config.get<string>('rutas.osrmUrl') ?? 'http://127.0.0.1:5000';
    const coords = puntos.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${base}/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=false`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const body = await res.json();
      if (body.code !== 'Ok' || !body.trips?.[0]) return null;
      const trip = body.trips[0];
      const waypoints: { waypoint_index: number }[] = body.waypoints ?? [];
      const ordenPuntos = waypoints
        .map((w, i) => ({ i, waypoint_index: w.waypoint_index }))
        .filter((w) => w.i !== 0)
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map((w) => w.i);
      const segundosAcumulados: number[] = [];
      let acc = 0;
      for (const leg of trip.legs ?? []) {
        acc += leg.duration;
        segundosAcumulados.push(acc);
      }
      return {
        proveedor: 'osrm',
        distancia_km: round2(trip.distance / 1000),
        duracion_min: Math.round(trip.duration / 60),
        ordenPuntos,
        segundosAcumulados,
      };
    } catch {
      return null;
    }
  }

  private async google(puntos: { lng: number; lat: number }[]): Promise<RutaCruda | null> {
    const key = this.config.get<string>('rutas.googleKey') ?? '';
    const origin = puntos[0];
    const destination = puntos[puntos.length - 1];
    const medios = puntos.slice(1, -1);
    const waypoints = medios.length
      ? `&waypoints=${encodeURIComponent('optimize:true|' + medios.map((p) => `${p.lat},${p.lng}`).join('|'))}`
      : '';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypoints}&key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (body.status !== 'OK' || !body.routes?.[0]) return null;
      const route = body.routes[0];
      const ordenIntermedios: number[] = route.waypoint_order ?? [];
      const ordenPuntos = [...ordenIntermedios.map((i: number) => i + 1), puntos.length - 1].filter((i) => i !== 0);
      const segundosAcumulados: number[] = [];
      let acc = 0;
      let metros = 0;
      for (const leg of route.legs ?? []) {
        acc += leg.duration.value;
        metros += leg.distance.value;
        segundosAcumulados.push(acc);
      }
      return {
        proveedor: 'google',
        distancia_km: round2(metros / 1000),
        duracion_min: Math.round(acc / 60),
        ordenPuntos,
        segundosAcumulados,
      };
    } catch {
      return null;
    }
  }
}
