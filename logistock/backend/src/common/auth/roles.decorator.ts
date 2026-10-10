import { SetMetadata } from '@nestjs/common';

export type Rol = 'asesor_ventas' | 'operario_bodega' | 'despachador' | 'administrador';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
export const PUBLICO_KEY = 'publico';
export const Publico = () => SetMetadata(PUBLICO_KEY, true);

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: Rol;
  bodega_id: string | null;
}
