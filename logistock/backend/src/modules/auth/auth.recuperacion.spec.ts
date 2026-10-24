import { esSesionDeRecuperacion } from './auth.controller';

const jwt = (carga: object) => `x.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.y`;
const AHORA = 1_800_000_000;

describe('esSesionDeRecuperacion', () => {
  it('acepta la sesión reciente que nace del enlace del correo', () => {
    expect(esSesionDeRecuperacion(jwt({ amr: [{ method: 'recovery', timestamp: AHORA - 60 }] }), AHORA)).toBe(true);
    expect(esSesionDeRecuperacion(jwt({ amr: [{ method: 'otp', timestamp: AHORA - 60 }] }), AHORA)).toBe(true);
  });

  it('rechaza un login con contraseña, un enlace viejo o un token mal formado', () => {
    expect(esSesionDeRecuperacion(jwt({ amr: [{ method: 'password', timestamp: AHORA }] }), AHORA)).toBe(false);
    expect(esSesionDeRecuperacion(jwt({ amr: [{ method: 'otp', timestamp: AHORA - 16 * 60 }] }), AHORA)).toBe(false);
    expect(esSesionDeRecuperacion(jwt({}), AHORA)).toBe(false);
    expect(esSesionDeRecuperacion('no-es-un-jwt', AHORA)).toBe(false);
  });
});
