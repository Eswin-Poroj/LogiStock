import { sugerirViajes } from './carga';

const c = (numero: string, kg: number) => ({ pedido_id: numero, numero, kg });

describe('sugerirViajes', () => {
  it('si todo cabe, un solo viaje', () => {
    expect(sugerirViajes([c('A', 300), c('B', 200)], 1000).viajes).toEqual([{ pedidos: ['A', 'B'], kg: 500 }]);
  });

  it('reparte en dos viajes cuando la carga supera la capacidad', () => {
    const { viajes, no_caben } = sugerirViajes([c('A', 600), c('B', 500), c('C', 300)], 1000);
    expect(viajes).toEqual([{ pedidos: ['A', 'C'], kg: 900 }, { pedidos: ['B'], kg: 500 }]);
    expect(no_caben).toEqual([]);
  });

  it('marca el pedido que por sí solo excede el vehículo', () => {
    const { viajes, no_caben } = sugerirViajes([c('A', 1500), c('B', 100)], 1000);
    expect(no_caben).toEqual(['A']);
    expect(viajes).toEqual([{ pedidos: ['A'], kg: 1500 }, { pedidos: ['B'], kg: 100 }]);
  });
});
