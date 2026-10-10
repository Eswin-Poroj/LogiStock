import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

(globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
  ws as unknown as typeof WebSocket;

/** Cliente con service_role: omite RLS. Solo se usa desde el backend. */
@Injectable()
export class SupabaseService {
  readonly db: SupabaseClient;
  constructor(config: ConfigService) {
    this.db = createClient(
      config.getOrThrow<string>('supabase.url'),
      config.getOrThrow<string>('supabase.serviceRoleKey'),
      { auth: { persistSession: false } },
    );
  }
}
