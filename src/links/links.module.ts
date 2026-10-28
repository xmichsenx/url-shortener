import { Module } from '@nestjs/common';
import { LinksCache } from './links.cache.js';
import { LinksController } from './links.controller.js';
import { LinksRepository } from './links.repository.js';
import { LinksService } from './links.service.js';

@Module({
  controllers: [LinksController],
  providers: [LinksService, LinksRepository, LinksCache],
})
export class LinksModule {}
