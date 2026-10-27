import { bigint, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const links = pgTable('links', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Link = typeof links.$inferSelect;
