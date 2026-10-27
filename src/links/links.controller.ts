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
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/error-response.dto.js';
import type { Env } from '../config/env.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { LinkResponseDto } from './dto/link-response.dto.js';
import { LinksService } from './links.service.js';

@ApiTags('links')
@Controller()
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('links')
  @ApiOperation({ summary: 'Shorten a URL' })
  @ApiCreatedResponse({ type: LinkResponseDto })
  @ApiBadRequestResponse({
    description: 'The URL is missing, invalid or too long.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateLinkDto): Promise<LinkResponseDto> {
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
  @ApiOperation({
    summary: 'Follow a short link',
    description:
      'Redirects to the original URL. Swagger UI follows the redirect itself, so try it with curl or a browser tab to see the 302.',
  })
  @ApiParam({ name: 'code', example: 'aZ3kP9x' })
  @ApiFoundResponse({
    description: 'Redirect to the original URL, given in the Location header.',
    headers: {
      Location: { description: 'The original URL', schema: { type: 'string' } },
    },
  })
  @ApiNotFoundResponse({
    description: 'No short link with this code.',
    type: ErrorResponseDto,
  })
  async redirect(@Param('code') code: string) {
    const url = await this.linksService.resolve(code);
    if (!url) {
      throw new NotFoundException('Short link not found');
    }
    return { url, statusCode: HttpStatus.FOUND };
  }
}
