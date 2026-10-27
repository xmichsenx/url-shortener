# url-shortener

[![CI](https://github.com/xmichsenx/url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/xmichsenx/url-shortener/actions/workflows/ci.yml)

A URL shortener backend service built with TypeScript, NestJS and PostgreSQL.

🚧 Work in progress: the core shorten + redirect flow works; caching, analytics and rate limiting are next.

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

Responds with `302 Found` and the original URL in the `Location` header, or `404` if the code doesn't exist.

## Design decisions

- **Random base62 codes.** Codes are 7 characters drawn from `[0-9A-Za-z]` with a cryptographically secure RNG: about 3.5 trillion combinations, and not guessable from previous codes (unlike an encoded auto-increment ID).
- **The database guarantees uniqueness.** A unique constraint on `code` plus `INSERT ... ON CONFLICT DO NOTHING`; on the rare collision the service retries with a new code. Checking first and inserting second would race under concurrent requests.
- **302, not 301.** Browsers cache `301` redirects and stop hitting the server, which would make click analytics impossible later.
- **Same URL, new code.** Shortening the same URL twice creates two links, so each one can later get its own owner, expiry and stats.

## Tech stack

- [NestJS](https://nestjs.com/) on Node.js 24
- PostgreSQL 18 with [Drizzle ORM](https://orm.drizzle.team/) and SQL migrations
- OpenAPI docs with [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction)
- [Vitest](https://vitest.dev/) for unit tests, [Testcontainers](https://testcontainers.com/) for end-to-end tests against a real Postgres
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

## License

[MIT](LICENSE)
