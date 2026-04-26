import { ApiProperty } from '@nestjs/swagger';

export class DocumentUrlResponseDto {
  @ApiProperty({
    description: 'Signed URL for direct file access',
    example: 'https://example.com/files/documents/abc123/file.pdf?token=xyz',
  })
  url: string;

  @ApiProperty({
    description: 'URL expiration time in seconds',
    example: 3600,
  })
  expiresIn: number;
}
