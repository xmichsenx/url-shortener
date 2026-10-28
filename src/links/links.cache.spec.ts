import type { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import { LinksCache, linkCacheKey } from './links.cache.js';

const URL = 'https://example.com/some/long/path';
const TTL_SECONDS = 3600;

function setup() {
  const redis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  };
  const config = { get: () => TTL_SECONDS } as unknown as ConfigService<
    Env,
    true
  >;
  const cache = new LinksCache(redis as unknown as Redis, config);
  return { cache, redis, config };
}

describe('LinksCache', () => {
  it('reads URLs by code', async () => {
    const { cache, redis } = setup();
    redis.get.mockResolvedValue(URL);

    await expect(cache.get('aZ3kP9x')).resolves.toBe(URL);
    expect(redis.get).toHaveBeenCalledWith(linkCacheKey('aZ3kP9x'));
  });

  it('returns undefined on a miss', async () => {
    const { cache } = setup();

    await expect(cache.get('aZ3kP9x')).resolves.toBeUndefined();
  });

  it('stores URLs with the configured TTL', async () => {
    const { cache, redis } = setup();

    await cache.set('aZ3kP9x', URL);

    expect(redis.set).toHaveBeenCalledWith(
      linkCacheKey('aZ3kP9x'),
      URL,
      'EX',
      TTL_SECONDS,
    );
  });

  it('treats Redis errors as a miss', async () => {
    const { cache, redis } = setup();
    redis.get.mockRejectedValue(new Error('Connection is closed.'));

    await expect(cache.get('aZ3kP9x')).resolves.toBeUndefined();
  });

  it('swallows Redis errors on write', async () => {
    const { cache, redis } = setup();
    redis.set.mockRejectedValue(new Error('Command timed out'));

    await expect(cache.set('aZ3kP9x', URL)).resolves.toBeUndefined();
  });

  it('does nothing when caching is disabled', async () => {
    const { config } = setup();
    const cache = new LinksCache(null, config);

    await expect(cache.get('aZ3kP9x')).resolves.toBeUndefined();
    await expect(cache.set('aZ3kP9x', URL)).resolves.toBeUndefined();
  });
});
