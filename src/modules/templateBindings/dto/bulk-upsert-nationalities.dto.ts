import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Flip-binding-flow — one nationality row in the bulk-upsert payload.
 *
 * Combined with the request-level (templateId from the URL,
 * destinationCountryId from the envelope, visaTypeId from the
 * envelope) this is everything the service needs to upsert one
 * `binding_nationality_fees` row (and the parent `template_bindings`
 * row if the destination+visa-type combo has never been used before).
 *
 * Server-side validation rules (mirroring the inline UI rules):
 *   - When `isActive` is false, the fee/currency/expedited fields are
 *     ignored and the row's fee is soft-deleted.
 *   - When `isActive` is true: `governmentFeeAmount`, `serviceFeeAmount`,
 *     and `currencyCode` are required (class-validator catches missing
 *     numerics; the service catches missing currency).
 *   - When `expeditedEnabled` is true: `expeditedFeeAmount` is required
 *     AND `expeditedProcessingDays` is required AND
 *     `expeditedProcessingDays < processingDays`. The service enforces
 *     the comparison rule; the DB CHECK constraint is the safety net.
 */
export class BulkUpsertNationalityItem {
  @ApiProperty()
  @IsString()
  @IsUUID()
  nationalityCountryId!: string;

  /**
   * Entries feature — pricing is per (nationality, entry). Each item
   * carries one entry of the bound visa type; a nationality with N
   * entries sends N items (same nationalityCountryId, different
   * entryId). The upsert key is
   * (templateBindingId, nationalityCountryId, entryId).
   */
  @ApiProperty()
  @IsString()
  @IsUUID()
  entryId!: string;

  /**
   * `true` → upsert (create or revive + update this (nationality, entry)
   * fee). `false` → soft-delete that specific fee row only. The parent
   * binding only gets soft-deleted when its LAST active fee disappears
   * — see `bulkUpsertNationalities` in the service.
   */
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  governmentFeeAmount!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceFeeAmount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currencyCode!: string;

  /**
   * Per-nationality standard processing window in calendar days. The
   * dynamic form's earliest-selectable-arrival-date floor reads this
   * (or `expeditedProcessingDays` when the customer ticked Express).
   * Optional in the payload — when omitted the service applies the
   * schema default of 3.
   */
  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  processingDays?: number;

  @ApiProperty()
  @IsBoolean()
  expeditedEnabled!: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expeditedFeeAmount?: number;

  /**
   * Express processing window (calendar days). MUST be strictly less
   * than `processingDays` when expedited is enabled — anything else
   * would mean Express isn't actually faster than the standard option.
   */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expeditedProcessingDays?: number;
}

export class BulkUpsertNationalitiesDto {
  @ApiProperty({
    description:
      'Destination scope. Every nationality row in this batch sits under this destination + visa type. Self-rows (where nationalityCountryId == destinationCountryId) are rejected.',
  })
  @IsString()
  @IsUUID()
  destinationCountryId!: string;

  @ApiProperty({ description: 'Visa type scope.' })
  @IsString()
  @IsUUID()
  visaTypeId!: string;

  @ApiProperty({ type: [BulkUpsertNationalityItem] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertNationalityItem)
  nationalities!: BulkUpsertNationalityItem[];
}

export class BulkUpsertNationalitiesResponseDto {
  @ApiProperty({ description: 'Number of per-nationality fee rows newly created.' })
  created!: number;

  @ApiProperty({ description: 'Number of per-nationality fee rows updated.' })
  updated!: number;

  @ApiProperty({
    description:
      'Number of per-nationality fee rows soft-deleted (isActive=false on input). Includes the parent binding when its last active fee disappears.',
  })
  deleted!: number;

  @ApiProperty({
    description: 'Number of input rows skipped because they were already inactive.',
  })
  skipped!: number;
}
