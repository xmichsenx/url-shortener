import type { Link } from '../database/schema.js';
import { CODE_PATTERN } from './code.js';
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
  const service = new LinksService(repository as unknown as LinksRepository);
  return { service, repository };
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
    it('returns the URL for a known code', async () => {
      const { service, repository } = setup();
      repository.findByCode.mockResolvedValue(makeLink('aZ3kP9x'));

      await expect(service.resolve('aZ3kP9x')).resolves.toBe(URL);
    });

    it('returns undefined for an unknown code', async () => {
      const { service, repository } = setup();
      repository.findByCode.mockResolvedValue(undefined);

      await expect(service.resolve('aZ3kP9x')).resolves.toBeUndefined();
    });

    it.each(['short', 'toolongcode', 'bad-chr', 'favicon.ico'])(
      'skips the database for malformed code %s',
      async (code) => {
        const { service, repository } = setup();

        await expect(service.resolve(code)).resolves.toBeUndefined();
        expect(repository.findByCode).not.toHaveBeenCalled();
      },
    );
  });
});
