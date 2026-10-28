import { Injectable } from '@nestjs/common';
import type { Link } from '../database/schema.js';
import { CODE_PATTERN, generateCode } from './code.js';
import { LinksCache } from './links.cache.js';
import { LinksRepository } from './links.repository.js';

export const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class LinksService {
  constructor(
    private readonly links: LinksRepository,
    private readonly cache: LinksCache,
  ) {}

  async shorten(url: string): Promise<Link> {
    // The unique constraint on `code` is the source of truth: generate, try to
    // insert, and retry on the rare collision instead of checking first, which
    // would race with concurrent requests.
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const link = await this.links.tryInsert(generateCode(), url);
      if (link) {
        return link;
      }
    }
    throw new Error(
      `No free short code found after ${MAX_CODE_ATTEMPTS} attempts`,
    );
  }

  async resolve(code: string): Promise<string | undefined> {
    // Skip the cache and database for anything that can't be a valid code.
    if (!CODE_PATTERN.test(code)) {
      return undefined;
    }

    const cached = await this.cache.get(code);
    if (cached) {
      return cached;
    }

    const link = await this.links.findByCode(code);
    if (link) {
      // Not awaited: the visitor shouldn't wait for the cache write, and
      // LinksCache.set never rejects.
      void this.cache.set(code, link.url);
    }
    return link?.url;
  }
}
