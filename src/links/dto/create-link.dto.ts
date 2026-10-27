import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    description: 'The URL to shorten. Only http and https are accepted.',
    example: 'https://example.com/some/very/long/path',
    maxLength: 2048,
  })
  @IsString()
  @MaxLength(2048)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    // Blocks https://trusted.com@evil.com style URLs often used in phishing.
    disallow_auth: true,
  })
  url: string;
}
