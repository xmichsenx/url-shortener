import type { Link } from '../database/schema.js';
import { CODE_PATTERN } from './code.js';
import type { LinksCache } from './links.cache.js';
import type { LinksRepository } from './links.repository.js';
import { LinksService, MAX_CODE_ATTEMPTS } from './links.service.js';

const URL = 'https://example.com/some/long/path';

function makeLink(code: string, url = URL): Link {
  return { id: 1, code, url, createdAt: new Date() };
}

function setup() {
  const repository = {
    tryInsert: vi.fn<LinksRepository['tryInsert']>(),
    findByCode: vi.fn<LinksRepository['findByCode']>(),
  };
  // An empty cache by default, so tests that don't care about caching see
  // every lookup reach the repository.
  const cache = {
    get: vi.fn<LinksCache['get']>().mockResolvedValue(undefined),
    set: vi.fn<LinksCache['set']>().mockResolvedValue(undefined),
  };
  const service = new LinksService(
    repository as unknown as LinksRepository,
    cache as unknown as LinksCache,
  );
  return { service, repository, cache };
}

describe('LinksService', () => {
  describe('shorten', () => {
    it('stores the URL under a generated code', async () => {
      const { service, repository } = setup();
      repository.tryInsert.mockImplementation(async (code, url) =>
        makeLink(code, url),
      );

      const link = await service.shorten(URL);

      expect(link.url).toBe(URL);
      expect(link.code).toMatch(CODE_PATTERN);
      expect(repository.tryInsert).toHaveBeenCalledOnce();
    });

    it('retries with a new code when the code is taken', async () => {
      const { service, repository } = setup();
      repository.tryInsert
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockImplementation(async (code, url) => makeLink(code, url));

      await service.shorten(URL);

      expect(repository.tryInsert).toHaveBeenCalledTimes(3);
      const codes = repository.tryInsert.mock.calls.map(([code]) => code);
      expect(new Set(codes).size).toBe(3);
    });

    it('gives up after the maximum number of attempts', async () => {
      const { service, repository } = setup();
      repository.tryInsert.mockResolvedValue(undefined);

      await expect(service.shorten(URL)).rejects.toThrow(/No free short code/);
      expect(repository.tryInsert).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
    });
  });

  describe('resolve', () => {
    it('serves a cached URL without querying the database', async () => {
      const { service, repository, cache } = setup();
      cache.get.mockResolvedValue(URL);

      await expect(service.resolve('aZ3kP9x')).resolves.toBe(URL);
      expect(repository.findByCode).not.toHaveBeenCalled();
    });

    it('falls back to the database on a miss and caches the result', async () => {
      const { service, repository, cache } = setup();
      repository.findByCode.mockResolvedValue(makeLink('aZ3kP9x'));

      await expect(service.resolve('aZ3kP9x')).resolves.toBe(URL);
      expect(repository.findByCode).toHaveBeenCalledWith('aZ3kP9x');
      expect(cache.set).toHaveBeenCalledWith('aZ3kP9x', URL);
    });

    it('returns undefined for an unknown code and caches nothing', async () => {
      const { service, repository, cache } = setup();
      repository.findByCode.mockResolvedValue(undefined);

      await expect(service.resolve('aZ3kP9x')).resolves.toBeUndefined();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it.each(['short', 'toolongcode', 'bad-chr', 'favicon.ico'])(
      'skips the cache and database for malformed code %s',
      async (code) => {
        const { service, repository, cache } = setup();

        await expect(service.resolve(code)).resolves.toBeUndefined();
        expect(cache.get).not.toHaveBeenCalled();
        expect(repository.findByCode).not.toHaveBeenCalled();
      },
    );
  });
});
