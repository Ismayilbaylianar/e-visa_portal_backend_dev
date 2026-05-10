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

  /**
   * M11.10 (BUG 4) — Accepts either an applicant code
   * (APP-YYYY-NNNNNN) or a booking reference code (REF-YYYY-NNNNNN).
   * Field name kept as `applicationCode` for back-compat with
   * existing frontend builds that haven't deployed the rename yet.
   */
  @ApiProperty({
    description: 'Reference code (REF-YYYY-NNNNNN) OR application code (APP-YYYY-NNNNNN). The endpoint searches both columns.',
    example: 'REF-2026-000001',
  })
  @IsString()
  @IsNotEmpty()
  applicationCode: string;
}
