import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import request from 'supertest';
import { configureApp } from '../src/app.setup.js';
import { runMigrations } from '../src/database/migrations.js';
import { linkCacheKey } from '../src/links/links.cache.js';

const BASE_URL = 'https://sho.rt';
const LONG_URL = 'https://example.com/some/very/long/path?with=query#and-hash';

describe('Links (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let app: INestApplication;
  // Direct connections, used to inspect and tamper with state behind the
  // app's back.
  let db: Pool;
  let cache: Redis;
  let redisStopped = false;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:18-alpine').start(),
      new RedisContainer('redis:8-alpine').start(),
    ]);
    const databaseUrl = postgres.getConnectionUri();
    await runMigrations(databaseUrl);
    db = new Pool({ connectionString: databaseUrl });
    cache = new Redis(redis.getConnectionUrl());

    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.BASE_URL = BASE_URL;
    // Imported only now: ConfigModule.forRoot() reads the environment when
    // the module is evaluated, so a static import would miss the values above.
    const { AppModule } = await import('../src/app.module.js');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    cache?.disconnect();
    await db?.end();
    await Promise.all([
      postgres?.stop(),
      redisStopped ? undefined : redis?.stop(),
    ]);
  });

  const api = () => request(app.getHttpServer());

  async function createLink(url = LONG_URL): Promise<string> {
    const res = await api().post('/links').send({ url }).expect(201);
    return res.body.code;
  }

  describe('POST /links', () => {
    it('creates a short link', async () => {
      const res = await api()
        .post('/links')
        .send({ url: LONG_URL })
        .expect(201);

      expect(res.body).toEqual({
        code: expect.stringMatching(/^[0-9A-Za-z]{7}$/),
        url: LONG_URL,
        shortUrl: `${BASE_URL}/${res.body.code}`,
        createdAt: expect.any(String),
      });
    });

    it('creates a new code each time the same URL is shortened', async () => {
      const first = await api().post('/links').send({ url: LONG_URL });
      const second = await api().post('/links').send({ url: LONG_URL });

      expect(first.body.code).not.toBe(second.body.code);
    });

    it.each([
      ['a missing url', {}],
      ['a non-string url', { url: 42 }],
      ['a value that is not a URL', { url: 'not a url' }],
      ['a URL without a protocol', { url: 'example.com' }],
      ['a non-http protocol', { url: 'ftp://example.com/file' }],
      ['a javascript: URL', { url: 'javascript:alert(1)' }],
      ['credentials in the URL', { url: 'https://user:pass@example.com' }],
      [
        'a URL over 2048 characters',
        { url: `https://example.com/${'a'.repeat(2048)}` },
      ],
      ['unknown fields', { url: LONG_URL, admin: true }],
    ])('rejects %s with 400', async (_case, body) => {
      await api().post('/links').send(body).expect(400);
    });
  });

  describe('GET /:code', () => {
    it('redirects to the original URL with 302', async () => {
      const created = await api().post('/links').send({ url: LONG_URL });

      await api()
        .get(`/${created.body.code}`)
        .expect(302)
        .expect('Location', LONG_URL);
    });

    it('returns 404 for an unknown code', async () => {
      await api().get('/zzzzzzz').expect(404);
    });

    it('returns 404 for a malformed code', async () => {
      await api().get('/not-a-valid-code').expect(404);
    });
  });

  describe('Redis cache', () => {
    it('caches a link on its first redirect', async () => {
      const code = await createLink();
      expect(await cache.exists(linkCacheKey(code))).toBe(0);

      await api().get(`/${code}`).expect(302);

      // The cache write isn't awaited by the request, so give it a moment.
      await vi.waitFor(async () =>
        expect(await cache.get(linkCacheKey(code))).toBe(LONG_URL),
      );
      expect(await cache.ttl(linkCacheKey(code))).toBeGreaterThan(0);
    });

    it('serves cached links without querying Postgres', async () => {
      const code = await createLink();
      await api().get(`/${code}`).expect(302);
      await vi.waitFor(async () =>
        expect(await cache.exists(linkCacheKey(code))).toBe(1),
      );

      // With the row gone, only the cache can still answer.
      await db.query('DELETE FROM links WHERE code = $1', [code]);

      await api().get(`/${code}`).expect(302).expect('Location', LONG_URL);
    });

    it('does not cache unknown codes', async () => {
      await api().get('/zzzzzzz').expect(404);

      expect(await cache.exists(linkCacheKey('zzzzzzz'))).toBe(0);
    });
  });

  describe('API docs', () => {
    it('serves the OpenAPI spec with both endpoints', async () => {
      const res = await api().get('/docs-json').expect(200);

      expect(res.body.openapi).toMatch(/^3\./);
      expect(res.body.paths['/links'].post).toBeDefined();
      expect(res.body.paths['/{code}'].get.responses).toHaveProperty('302');
    });

    it('serves the Swagger UI', async () => {
      await api().get('/docs').expect(200).expect('Content-Type', /html/);
    });
  });

  // Must stay last: it stops the Redis container for the rest of the file.
  describe('when Redis is down', () => {
    it('keeps creating and redirecting from Postgres', async () => {
      cache.disconnect();
      await redis.stop();
      redisStopped = true;

      const started = Date.now();
      const code = await createLink();
      await api().get(`/${code}`).expect(302).expect('Location', LONG_URL);
      // A cache outage must not stall requests behind reconnect attempts.
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });
});
