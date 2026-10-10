import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

function cargarEnvSiFalta(): void {
  let texto = '';
  try {
    texto = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  } catch {
    return;
  }
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i < 1) continue;
    const clave = limpia.slice(0, i);
    if (process.env[clave] === undefined) process.env[clave] = limpia.slice(i + 1);
  }
}

export function assertEntornoLocal(): void {
  cargarEnvSiFalta();
  const u = process.env.SUPABASE_URL ?? '';
  const d = process.env.DATABASE_URL ?? '';
  const ok = (s: string) => /127\.0\.0\.1|localhost/.test(s);
  if (!ok(u) || !ok(d) || u.includes('lrjoozqkydvzptuzskjz') || d.includes('lrjoozqkydvzptuzskjz')) {
    throw new Error('ABORTADO: la base no es local');
  }
}

export async function crearApp(): Promise<INestApplication> {
  assertEntornoLocal();
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.init();
  return app;
}
