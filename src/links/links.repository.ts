import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { links, type Link } from '../database/schema.js';

@Injectable()
export class LinksRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Returns undefined when the code is already taken. */
  async tryInsert(code: string, url: string): Promise<Link | undefined> {
    const [link] = await this.db
      .insert(links)
      .values({ code, url })
      .onConflictDoNothing({ target: links.code })
      .returning();
    return link;
  }

  async findByCode(code: string): Promise<Link | undefined> {
    const [link] = await this.db
      .select()
      .from(links)
      .where(eq(links.code, code))
      .limit(1);
    return link;
  }
}
