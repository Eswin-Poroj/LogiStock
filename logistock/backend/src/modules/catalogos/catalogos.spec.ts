import { categoriaDe, prefijoDe } from './catalogos.controller';

describe('SKU automático', () => {
  it('toma tres letras de la categoría, sin tildes ni símbolos', () => {
    expect(prefijoDe('Ferretería')).toBe('FER');
    expect(prefijoDe('  pinturas ')).toBe('PIN');
    expect(prefijoDe('Ñandú eléctrico')).toBe('NAN');
    expect(prefijoDe('7')).toBe('PRD');
  });

  it('la categoría de un SKU es su prefijo', () => {
    expect(categoriaDe('FER-0013')).toBe('FER');
  });
});
