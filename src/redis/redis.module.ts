import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

/** Injects a Redis client, or null when REDIS_URL is not set. */
export const REDIS = Symbol('REDIS');

// Redis is only a cache here, so a slow command is treated as a miss rather
// than holding up the redirect.
const COMMAND_TIMEOUT_MS = 200;

function createRedis(url: string): Redis {
  const logger = new Logger('Redis');
  const redis = new Redis(url, {
    // Fail commands straight away while disconnected instead of queueing them
    // until Redis comes back, which would stall every redirect.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: COMMAND_TIMEOUT_MS,
  });

  // ioredis emits an error on every reconnect attempt; log only the
  // transitions so an outage doesn't flood the logs.
  let available = true;
  redis.on('error', (err: Error) => {
    if (available) {
      logger.warn(
        `Unavailable, serving redirects from Postgres: ${err.message}`,
      );
      available = false;
    }
  });
  redis.on('ready', () => {
    if (!available) {
      logger.log('Reconnected');
      available = true;
    }
  });

  return redis;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis | null => {
        const url = config.get('REDIS_URL', { infer: true });
        if (!url) {
          new Logger('Redis').log('REDIS_URL not set, caching disabled');
          return null;
        }
        return createRedis(url);
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.redis) {
      return;
    }
    // quit() waits for pending replies but rejects if Redis is already gone.
    await this.redis.quit().catch(() => this.redis?.disconnect());
  }
}
