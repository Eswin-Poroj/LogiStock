import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Publico, UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';

export class LoginDto {
  @IsEmail() correo: string;
  @IsString() clave: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Publico()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const { data, error } = await this.supabase.db.auth.signInWithPassword({
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

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() usuario: UsuarioActual) {
    return usuario;
  }
}
