import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateApplicantDto {
  @ApiProperty({
    description: 'Whether this is the main applicant',
    example: true,
  })
  @IsBoolean()
  isMainApplicant: boolean;

  @ApiProperty({
    description: 'Applicant email address',
    example: 'applicant@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Applicant phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Form data as JSON object',
    example: { firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01' },
  })
  @IsObject()
  formDataJson: Record<string, any>;
}
