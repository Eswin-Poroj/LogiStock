import { Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { UsuarioActual } from '../../common/auth/roles.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';

/** Avisos para cada usuario; hoy los genera el picking con faltante (CU-05 E2). */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async mias(@CurrentUser() usuario: UsuarioActual) {
    const { data, error } = await this.supabase.db.from('notificaciones')
      .select('id, tipo, mensaje, pedido_id, leida, created_at')
      .eq('usuario_id', usuario.id).order('created_at', { ascending: false }).limit(30);
    if (error) throw new NotFoundException(error.message);
    return data;
  }

  @HttpCode(200)
  @Post(':id/leida')
  async leida(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() usuario: UsuarioActual) {
    // Solo marca las propias: el filtro por usuario impide tocar avisos ajenos.
    const { data, error } = await this.supabase.db.from('notificaciones').update({ leida: true })
      .eq('id', id).eq('usuario_id', usuario.id).select('id, leida').maybeSingle();
    if (error || !data) throw new NotFoundException('Notificación no encontrada');
    return data;
  }

  @HttpCode(200)
  @Post('leidas')
  async todasLeidas(@CurrentUser() usuario: UsuarioActual) {
    await this.supabase.db.from('notificaciones').update({ leida: true }).eq('usuario_id', usuario.id).eq('leida', false);
    return { ok: true };
  }
}
