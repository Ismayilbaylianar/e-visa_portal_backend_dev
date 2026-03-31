import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({
    description: 'Unique template key identifier',
    example: 'APPLICATION_APPROVED',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  templateKey: string;

  @ApiProperty({
    description: 'Email subject line',
    example: 'Your visa application has been approved',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiProperty({
    description: 'HTML body of the email',
    example: '<h1>Congratulations!</h1><p>Your visa has been approved.</p>',
  })
  @IsString()
  @IsNotEmpty()
  bodyHtml: string;

  @ApiPropertyOptional({
    description: 'Plain text body of the email',
    example: 'Congratulations! Your visa has been approved.',
  })
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
