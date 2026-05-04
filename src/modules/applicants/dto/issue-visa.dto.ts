import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Module 9 — body fields for POST issue-visa. The actual PDF rides
 * the multipart form-data `file` field; these are the metadata
 * captured alongside.
 */
export class IssueVisaDto {
  @ApiPropertyOptional({
    description: 'Government / consular reference number (e.g. "TR-2026-001234")',
    example: 'TR-2026-001234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'Admin notes saved alongside the visa (visible to other admins, not the customer)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
