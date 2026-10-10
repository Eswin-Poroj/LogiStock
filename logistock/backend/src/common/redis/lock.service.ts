import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';

/**
 * Lock distribuido por SKU y bodega (riesgo R1).
 * Se adquieren todas las llaves de un pedido en un solo paso y ordenadas,
 * para que dos pedidos con los mismos SKU nunca se bloqueen entre sí (sin deadlock).
 */
@Injectable()
export class LockService implements OnModuleDestroy {
  readonly redis: Redis;
  private readonly redlock: Redlock;
  private readonly ttl: number;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.getOrThrow<string>('redis.url'), { maxRetriesPerRequest: null });
    this.ttl = config.get<number>('lockTtlMs') ?? 5000;
    this.redlock = new Redlock([this.redis], {
      retryCount: 5,
      retryDelay: 100, // ms
      retryJitter: 50, // ms  → espera máxima ≈ 0.5 s
    });
  }

  static llaveStock(productoId: string, bodegaId: string) {
    return `lock:stock:${bodegaId}:${productoId}`;
  }

  /** Ejecuta `fn` con los locks tomados; si no se obtienen a tiempo responde 423. */
  async conLocks<T>(llaves: string[], fn: () => Promise<T>): Promise<T> {
    const ordenadas = [...new Set(llaves)].sort();
    let lock;
    try {
      lock = await this.redlock.acquire(ordenadas, this.ttl);
    } catch {
      throw new HttpException(
        'El producto está siendo reservado por otra operación. Intenta de nuevo.',
        423,
      );
    }
    try {
      return await fn();
    } finally {
      await lock.release().catch(() => undefined); // si expiró, la reserva SQL sigue siendo atómica
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
