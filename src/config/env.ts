export interface Env {
  PORT: number;
  BASE_URL: string;
  DATABASE_URL: string;
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

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  return {
    PORT: port,
    BASE_URL: (baseUrl as string).replace(/\/+$/, ''),
    DATABASE_URL: databaseUrl as string,
  };
}
