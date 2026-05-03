import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * Module 9 — Bulk Copy nationality fees within a single binding.
 *
 * Copies the fee values (governmentFee/serviceFee/expeditedFee/
 * currencyCode/expeditedEnabled) from one nationality to a list of
 * target nationalities under the same binding. Designed for the common
 * "set the same price for AZ + RU + UA + KZ" admin task — saving 4
 * separate POSTs.
 *
 * `overwriteExisting=false` (default) skips targets that already have
 * a fee row. `overwriteExisting=true` updates existing rows with the
 * source values. Either way the target list is processed atomically
 * inside one transaction so partial copies don't leave the binding
 * inconsistent.
 */
export class BulkCopyFeesDto {
  @ApiProperty({
    description:
      'Source nationality UUID. Must already have a fee on this binding.',
    example: '8c7e3b3a-1234-5678-9abc-def012345678',
  })
  @IsUUID()
  sourceNationalityCountryId!: string;

  @ApiProperty({
    description:
      'Target nationality UUIDs. Each target must NOT already have an active fee on this binding unless overwriteExisting=true.',
    type: [String],
    example: ['<uuid-RU>', '<uuid-UA>', '<uuid-KZ>'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one target nationality is required' })
  @ArrayMaxSize(250, { message: 'No more than 250 targets allowed per call' })
  @ArrayUnique({ message: 'Target nationality IDs must be unique' })
  @IsUUID('4', { each: true, message: 'Each target id must be a valid UUID' })
  targetNationalityCountryIds!: string[];

  @ApiPropertyOptional({
    description:
      'When true, overwrite the source values onto targets that already have a fee. When false (default), skip targets that already have a fee and report them in the response.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;
}

/**
 * Response shape: counters so the admin UI can show a clear summary
 * ("3 created, 1 updated, 2 skipped") and the per-target outcome list
 * for surfacing skip reasons.
 */
export class BulkCopyFeesResultDto {
  @ApiProperty({ example: 3 })
  created!: number;

  @ApiProperty({ example: 1 })
  updated!: number;

  @ApiProperty({ example: 2 })
  skipped!: number;

  @ApiProperty({
    description: 'Per-target outcome for diagnostics',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        nationalityCountryId: { type: 'string' },
        outcome: {
          type: 'string',
          enum: ['created', 'updated', 'skipped_exists', 'skipped_self'],
        },
      },
    },
  })
  details!: Array<{
    nationalityCountryId: string;
    outcome: 'created' | 'updated' | 'skipped_exists' | 'skipped_self';
  }>;
}
