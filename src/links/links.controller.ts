import {
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Redirect,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { LinksService } from './links.service.js';

export interface LinkResponse {
  code: string;
  url: string;
  shortUrl: string;
  createdAt: string;
}

@Controller()
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('links')
  async create(@Body() dto: CreateLinkDto): Promise<LinkResponse> {
    const link = await this.linksService.shorten(dto.url);
    return {
      code: link.code,
      url: link.url,
      shortUrl: `${this.config.get('BASE_URL', { infer: true })}/${link.code}`,
      createdAt: link.createdAt.toISOString(),
    };
  }

  // 302 rather than 301: browsers cache 301s and would skip this server on
  // later visits, which would make click analytics impossible.
  @Get(':code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    const url = await this.linksService.resolve(code);
    if (!url) {
      throw new NotFoundException('Short link not found');
    }
    return { url, statusCode: HttpStatus.FOUND };
  }
}
