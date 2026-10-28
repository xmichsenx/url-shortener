export interface Env {
  PORT: number;
  BASE_URL: string;
  DATABASE_URL: string;
  /** Optional: without it, redirects are served straight from Postgres. */
  REDIS_URL?: string;
  CACHE_TTL_SECONDS: number;
}

// Passed to ConfigModule so the app refuses to start with a broken config,
// instead of failing later on the first request.
export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = raw.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl === '') {
    errors.push('DATABASE_URL is required');
  }

  const baseUrl = raw.BASE_URL ?? `http://localhost:${port}`;
  if (typeof baseUrl !== 'string' || !URL.canParse(baseUrl)) {
    errors.push('BASE_URL must be an absolute URL');
  }

  const redisUrl = raw.REDIS_URL === '' ? undefined : raw.REDIS_URL;
  if (
    redisUrl !== undefined &&
    (typeof redisUrl !== 'string' ||
      !/^rediss?:$/.test(URL.parse(redisUrl)?.protocol ?? ''))
  ) {
    errors.push('REDIS_URL must be a redis:// or rediss:// URL');
  }

  const cacheTtl = Number(raw.CACHE_TTL_SECONDS ?? 86400);
  if (!Number.isInteger(cacheTtl) || cacheTtl < 1) {
    errors.push('CACHE_TTL_SECONDS must be a positive integer');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    PORT: port,
    BASE_URL: (baseUrl as string).replace(/\/+$/, ''),
    DATABASE_URL: databaseUrl as string,
    REDIS_URL: redisUrl as string | undefined,
    CACHE_TTL_SECONDS: cacheTtl,
  };
}
