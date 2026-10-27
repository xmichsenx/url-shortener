import { ApiProperty } from '@nestjs/swagger';

export class LinkResponseDto {
  @ApiProperty({ example: 'aZ3kP9x', pattern: '^[0-9A-Za-z]{7}$' })
  code: string;

  @ApiProperty({ example: 'https://example.com/some/very/long/path' })
  url: string;

  @ApiProperty({ example: 'http://localhost:3000/aZ3kP9x' })
  shortUrl: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-27T22:08:52.532Z' })
  createdAt: string;
}
