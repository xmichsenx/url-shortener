import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { LinksModule } from './links/links.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    LinksModule,
  ],
})
export class AppModule {}
