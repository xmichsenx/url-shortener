# url-shortener

[![CI](https://github.com/xmichsenx/url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/xmichsenx/url-shortener/actions/workflows/ci.yml)

A URL shortener backend service built with TypeScript, NestJS, PostgreSQL and Redis.

🚧 Work in progress: shortening, redirects and caching work; analytics and rate limiting are next.

## API

Interactive docs (Swagger UI) are served at [`/docs`](http://localhost:3000/docs), and the raw OpenAPI spec at [`/docs-json`](http://localhost:3000/docs-json).

### `POST /links` - shorten a URL

```http
POST /links
Content-Type: application/json

{ "url": "https://example.com/some/very/long/path" }
```

```json
{
  "code": "aZ3kP9x",
  "url": "https://example.com/some/very/long/path",
  "shortUrl": "http://localhost:3000/aZ3kP9x",
  "createdAt": "2026-10-27T22:08:52.532Z"
}
```

Only `http` and `https` URLs up to 2048 characters are accepted. Invalid input returns `400`.

### `GET /:code` - follow a short link

Responds with `302 Found` and the original URL in the `Location` header, or `404` if the code doesn't exist. Lookups go through a Redis cache before Postgres.

## Design decisions

- **Random base62 codes.** Codes are 7 characters drawn from `[0-9A-Za-z]` with a cryptographically secure RNG: about 3.5 trillion combinations, and not guessable from previous codes (unlike an encoded auto-increment ID).
- **The database guarantees uniqueness.** A unique constraint on `code` plus `INSERT ... ON CONFLICT DO NOTHING`; on the rare collision the service retries with a new code. Checking first and inserting second would race under concurrent requests.
- **302, not 301.** Browsers cache `301` redirects and stop hitting the server, which would make click analytics impossible later.
- **Same URL, new code.** Shortening the same URL twice creates two links, so each one can later get its own owner, expiry and stats.

### Redirect caching

A shortener is read-heavy: each link is created once and followed many times, and a few popular links get most of the traffic. Redirects therefore use a **cache-aside** Redis cache:

```
GET /:code ──▶ Redis ──hit──▶ 302
                 │
                miss
                 ▼
             Postgres ──found──▶ 302, and cache code → URL (TTL 24h)
                 │
             not found ──▶ 404
```

- **Fail-open.** Redis is an optimisation, never a dependency. If it's down or slow, lookups fall back to Postgres: commands fail immediately while disconnected (no offline queue) and time out after 200 ms, so an outage can't stall redirects. An outage is logged once, not on every request. An e2e test stops Redis mid-run to prove it.
- **The cache write isn't awaited.** The visitor gets their redirect without waiting for Redis to store it.
- **No invalidation needed yet.** Links can't be edited or deleted, so a cached entry can't go stale. The TTL (`CACHE_TTL_SECONDS`, default 24h) keeps memory bounded to links that are actually being used.
- **Unknown codes aren't cached.** Malformed codes are rejected before touching Redis or Postgres, but repeated lookups of well-formed unknown codes still reach Postgres. Caching misses briefly ("negative caching") is a possible next step.
- **Optional.** Without `REDIS_URL` the app runs uncached, which keeps local setup simple.

### Load test

`npm run load-test` creates a link and requests it with 50 concurrent connections for 20 seconds ([autocannon](https://github.com/mcollina/autocannon), redirects not followed). Same build, run once without and once with `REDIS_URL`:

| | Postgres only | With Redis cache |
| --- | --- | --- |
| Requests/s | 5,591 | **16,762** (3.0x) |
| Latency p50 | 8 ms | **2 ms** |
| Latency p99 | 13 ms | **5 ms** |
| Errors | 0 | 0 |

The app, Postgres, Redis and the load generator all ran on one Windows laptop (Postgres and Redis in Docker Desktop), so the absolute numbers are only indicative. Part of the gap is the Postgres connection pool (10 connections by default): with 50 concurrent requests, uncached lookups wait for a free connection, while cached ones skip the pool entirely. Taking that load off the database is the point of the cache.

## Tech stack

- [NestJS](https://nestjs.com/) on Node.js 24
- PostgreSQL 18 with [Drizzle ORM](https://orm.drizzle.team/) and SQL migrations
- Redis 8 with [ioredis](https://github.com/redis/ioredis) for caching
- OpenAPI docs with [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction)
- [Vitest](https://vitest.dev/) for unit tests, [Testcontainers](https://testcontainers.com/) for end-to-end tests against real Postgres and Redis
- GitHub Actions CI: format, lint, typecheck, unit tests, build, e2e tests

## Running locally

Requirements: Node.js 24 and Docker.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run start:dev
```

The API listens on `http://localhost:3000`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs Docker) |
| `npm run lint` / `npm run typecheck` / `npm run format` | Code quality |
| `npm run db:generate` | Generate a migration after changing `src/database/schema.ts` |
| `npm run db:migrate` | Build and apply pending migrations |
| `npm run load-test -- [baseUrl] [seconds]` | Load-test redirects against a running app |

## License

[MIT](LICENSE)
