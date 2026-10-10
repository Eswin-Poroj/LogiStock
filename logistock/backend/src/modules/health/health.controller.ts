import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Publico } from '../../common/auth/roles.decorator';
import { LockService } from '../../common/redis/lock.service';
import { SupabaseService } from '../../common/supabase/supabase.service';

@ApiTags('Sistema')
@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService, private readonly lock: LockService) {}

  @Publico()
  @Get()
  async estado() {
    const bd = await this.supabase.db.from('bodegas').select('id', { head: true, count: 'exact' });
    const redis = await this.lock.redis.ping().then(() => 'ok', () => 'error');
    return { estado: 'ok', base_datos: bd.error ? 'error' : 'ok', redis };
  }
}
