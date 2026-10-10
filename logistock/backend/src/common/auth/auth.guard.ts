import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service';
import { PUBLICO_KEY, ROLES_KEY, Rol } from './roles.decorator';

/** Valida el JWT de Supabase, carga el perfil (rol) y aplica @Roles(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO_KEY, objetivos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Falta el token');

    const { data, error } = await this.supabase.db.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Token inválido o vencido');

    const { data: perfil } = await this.supabase.db
      .from('usuarios')
      .select('id, nombre, rol, bodega_id, activo')
      .eq('id', data.user.id)
      .single();
    if (!perfil || !perfil.activo) throw new UnauthorizedException('Usuario sin perfil activo');
    req.user = perfil;

    const permitidos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, objetivos);
    if (permitidos?.length && perfil.rol !== 'administrador' && !permitidos.includes(perfil.rol)) {
      throw new ForbiddenException('Tu rol no tiene permiso para esta operación');
    }
    return true;
  }
}
