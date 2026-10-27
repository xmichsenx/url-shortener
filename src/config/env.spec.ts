import { validateEnv } from './env.js';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('validateEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      PORT: 3000,
      BASE_URL: 'http://localhost:3000',
      DATABASE_URL,
    });
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
