import { validateEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('validateEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      PORT: 3000,
      BASE_URL: 'http://localhost:3000',
      DATABASE_URL,
      REDIS_URL: undefined,
      CACHE_TTL_SECONDS: 86400,
    });
  });

  it('accepts redis and rediss URLs and treats an empty one as unset', () => {
    expect(
      validateEnv({ DATABASE_URL, REDIS_URL: 'redis://localhost:6379' })
        .REDIS_URL,
    ).toBe('redis://localhost:6379');
    expect(
      validateEnv({ DATABASE_URL, REDIS_URL: 'rediss://cache.example.com' })
        .REDIS_URL,
    ).toBe('rediss://cache.example.com');
    expect(validateEnv({ DATABASE_URL, REDIS_URL: '' }).REDIS_URL).toBe(
      undefined,
    );
  });

  it.each([
    [{ REDIS_URL: 'http://localhost:6379' }, /REDIS_URL must be/],
    [{ CACHE_TTL_SECONDS: '0' }, /CACHE_TTL_SECONDS must be/],
    [{ CACHE_TTL_SECONDS: '1.5' }, /CACHE_TTL_SECONDS must be/],
  ])('rejects %o', (vars, error) => {
    expect(() => validateEnv({ DATABASE_URL, ...vars })).toThrow(error);
  });

  it('parses PORT and strips trailing slashes from BASE_URL', () => {
    const env = validateEnv({
      DATABASE_URL,
      PORT: '8080',
      BASE_URL: 'https://sho.rt//',
    });
    expect(env.PORT).toBe(8080);
    expect(env.BASE_URL).toBe('https://sho.rt');
  });

  it('reports every invalid variable at once', () => {
    expect(() => validateEnv({ PORT: 'abc', BASE_URL: 'not a url' })).toThrow(
      /PORT must be.*\n.*DATABASE_URL is required.*\n.*BASE_URL must be/s,
    );
  });
});
