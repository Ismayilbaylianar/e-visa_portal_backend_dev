import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    description: 'Document type key identifying the type of document',
    example: 'passport',
  })
  @IsNotEmpty()
  @IsString()
  documentTypeKey: string;

  @ApiProperty({
    description: 'Applicant ID the document belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  applicantId: string;
}

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

export class UploadDocumentBodyDto {
  @ApiProperty({
    description: 'Document type key identifying the type of document',
    example: 'passport',
  })
  @IsNotEmpty()
  @IsString()
  documentTypeKey: string;

  @ApiProperty({
    description: 'Applicant ID the document belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  applicantId: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The document file to upload',
  })
  file: MulterFile;
}
