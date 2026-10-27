import { runMigrations } from './migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

await runMigrations(databaseUrl);
console.log('Migrations applied');
