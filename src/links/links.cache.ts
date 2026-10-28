import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import { REDIS } from '../redis/redis.module.js';

export function linkCacheKey(code: string): string {
  return `link:${code}`;
}

/**
 * Cache-aside store for code -> URL lookups. Every method fails open: when
 * Redis is disabled, down or slow, reads behave like a miss and writes are
 * skipped, so the cache can only ever make redirects faster, never break them.
 * Outages are logged once by RedisModule rather than on every command.
 */
@Injectable()
export class LinksCache {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis | null,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('CACHE_TTL_SECONDS', { infer: true });
  }

  async get(code: string): Promise<string | undefined> {
    if (!this.redis) {
      return undefined;
    }
    try {
      return (await this.redis.get(linkCacheKey(code))) ?? undefined;
    } catch {
      return undefined;
    }
  }

  async set(code: string, url: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.set(linkCacheKey(code), url, 'EX', this.ttlSeconds);
    } catch {
      // Skipped: the next request for this code falls back to Postgres.
    }
  }
}
