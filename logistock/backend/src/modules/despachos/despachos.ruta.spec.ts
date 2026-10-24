import { DespachosService } from './despachos.service';
import { decodificarPolilinea } from './rutas.client';

/** Prueba unitaria: la ruta calculada trae las coordenadas que el mapa de la Figura 8 necesita. */
describe('DespachosService.calcularRuta', () => {
  it('devuelve el origen, la posición de cada parada y el trazo del motor', async () => {
    const tabla: any = {
      bodegas: { select: () => ({ eq: () => ({ single: async () => ({ data: { nombre: 'Bodega Central', direccion: 'Zona 1', latitud: '14.834700', longitud: '-91.518100' } }) }) }) },
      pedidos: {
        select: () => ({
          in: async () => ({
            data: [
              { id: 'p1', clientes: { nombre: 'Ferretería El Tornillo', direccion: 'Zona 3', latitud: '14.840000', longitud: '-91.520000' } },
              { id: 'p2', clientes: { nombre: 'Depósito San Pedro', direccion: 'San Pedro', latitud: '14.960000', longitud: '-91.770000' } },
            ],
          }),
        }),
      },
    };
    const db: any = { from: (t: string) => tabla[t] };
    const trazo: [number, number][] = [[14.8347, -91.5181], [14.84, -91.52], [14.96, -91.77]];
    const rutas: any = {
      calcular: jest.fn().mockResolvedValue({
        proveedor: 'osrm',
        distancia_km: 30.5,
        duracion_min: 50,
        ordenPuntos: [2, 1],
        segundosAcumulados: [600, 3000],
        trazo,
      }),
    };
    const servicio = new DespachosService({ db } as any, rutas);

    const ruta = await servicio.calcularRuta({ bodega_id: 'b', pedido_ids: ['p1', 'p2'], salida_prevista: '2026-10-10T15:00:00.000Z' } as any);

    expect(ruta.origen).toEqual({ nombre: 'Bodega Central', direccion: 'Zona 1', latitud: 14.8347, longitud: -91.5181 });
    expect(ruta.paradas.map((p) => [p.pedido_id, p.latitud, p.longitud])).toEqual([
      ['p2', 14.96, -91.77],
      ['p1', 14.84, -91.52],
    ]);
    expect(ruta.trazo).toEqual(trazo);
  });
});

describe('decodificarPolilinea', () => {
  it('decodifica el ejemplo de la documentación de Google', () => {
    expect(decodificarPolilinea('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  });
});
