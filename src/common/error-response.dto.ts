import { ApiProperty } from '@nestjs/swagger';

// Documents the body of Nest's built-in HTTP exceptions; nothing constructs
// this class at runtime.
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['url must be a URL address'],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
