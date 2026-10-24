import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

(globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
  ws as unknown as typeof WebSocket;

const opcionesAuth = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * Cliente con service_role: omite RLS. Solo se usa desde el backend.
 * El cliente `auth` (anon) valida credenciales y JWT sin reemplazar la sesión del service_role:
 * si signInWithPassword corriera sobre el mismo cliente, PostgREST heredaría el JWT del asesor
 * y funciones como reservar_stock dejarían de poder actualizar stock (solo lectura vía RLS).
 */
@Injectable()
export class SupabaseService {
  readonly db: SupabaseClient;
  readonly auth: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('supabase.url');
    this.db = createClient(url, config.getOrThrow<string>('supabase.serviceRoleKey'), opcionesAuth);
    this.auth = createClient(url, config.getOrThrow<string>('supabase.anonKey'), opcionesAuth);
  }
}
