import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Unique template key identifier',
    example: 'APPLICATION_APPROVED',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  templateKey?: string;

  @ApiPropertyOptional({
    description: 'Email subject line',
    example: 'Your visa application has been approved',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({
    description: 'HTML body of the email',
    example: '<h1>Congratulations!</h1><p>Your visa has been approved.</p>',
  })
  @IsOptional()
  @IsString()
  bodyHtml?: string;

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
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
