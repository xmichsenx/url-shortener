import { IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateLinkDto {
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
