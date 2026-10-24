import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Publico, UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';

export class LoginDto {
  @IsEmail() correo: string;
  @IsString() clave: string;
}

export class RecuperarDto {
  @IsEmail() correo: string;
}

export class RestablecerDto {
  @IsString() access_token: string;
  @IsString() @MinLength(8) clave: string;
}

const VIGENCIA_ENLACE_S = 15 * 60;

/**
 * El JWT ya lo validó Supabase (getUser); aquí solo se lee cómo se autenticó la sesión.
 * El enlace de recuperación deja amr = recovery (u otp en GoTrue reciente): ambos prueban
 * control del correo. Un login con contraseña (password) no sirve, y la sesión debe ser reciente.
 */
export function esSesionDeRecuperacion(jwt: string, ahora = Date.now() / 1000): boolean {
  try {
    const carga = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    if (!Array.isArray(carga.amr)) return false;
    return carga.amr.some((m: { method?: string; timestamp?: number }) =>
      (m?.method === 'recovery' || m?.method === 'otp') && typeof m.timestamp === 'number' && ahora - m.timestamp <= VIGENCIA_ENLACE_S);
  } catch {
    return false;
  }
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}

  @Publico()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const { data, error } = await this.supabase.auth.auth.signInWithPassword({
      email: dto.correo,
      password: dto.clave,
    });
    if (error || !data.session) throw new UnauthorizedException('Credenciales incorrectas');
    const { data: usuario } = await this.supabase.db
      .from('usuarios')
      .select('id, nombre, rol, bodega_id')
      .eq('id', data.user.id)
      .single();
    return { access_token: data.session.access_token, expira_en: data.session.expires_in, usuario };
  }

  /**
   * CU-11 A1: envía el correo de recuperación de Supabase Auth. Responde igual exista o no
   * la cuenta, para no revelar qué correos están registrados.
   */
  @Publico()
  @HttpCode(202)
  @Post('recuperar')
  async recuperar(@Body() dto: RecuperarDto) {
    await this.supabase.auth.auth.resetPasswordForEmail(dto.correo, {
      redirectTo: `${this.config.get<string>('frontendUrl')}/restablecer`,
    });
    return { mensaje: 'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.' };
  }

  /**
   * Recibe el token del enlace de recuperación y fija la nueva contraseña.
   * Solo acepta sesiones recientes nacidas del enlace del correo: un token de login normal
   * no sirve para cambiar la clave sin conocer la anterior. Después cierra todas las sesiones.
   */
  @Publico()
  @HttpCode(200)
  @Post('restablecer')
  async restablecer(@Body() dto: RestablecerDto) {
    const invalido = new UnauthorizedException('El enlace venció o no es válido');
    const { data, error } = await this.supabase.auth.auth.getUser(dto.access_token);
    if (error || !data.user || !esSesionDeRecuperacion(dto.access_token)) throw invalido;
    const upd = await this.supabase.db.auth.admin.updateUserById(data.user.id, { password: dto.clave });
    if (upd.error) throw invalido;
    await this.supabase.db.auth.admin.signOut(dto.access_token, 'global');
    return { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() usuario: UsuarioActual) {
    return usuario;
  }
}
