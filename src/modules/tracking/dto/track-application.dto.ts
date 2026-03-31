import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class TrackApplicationDto {
  @ApiProperty({
    description: 'Email address used for the application',
    example: 'applicant@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Application code received after submission',
    example: 'APP-2024-001234',
  })
  @IsString()
  @IsNotEmpty()
  applicationCode: string;
}
