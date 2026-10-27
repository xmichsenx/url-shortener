import { Injectable } from '@nestjs/common';
import type { Link } from '../database/schema.js';
import { CODE_PATTERN, generateCode } from './code.js';
import { LinksRepository } from './links.repository.js';

export const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class LinksService {
  constructor(private readonly links: LinksRepository) {}

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
    // Skip the database for anything that can't be a valid code.
    if (!CODE_PATTERN.test(code)) {
      return undefined;
    }
    const link = await this.links.findByCode(code);
    return link?.url;
  }
}
