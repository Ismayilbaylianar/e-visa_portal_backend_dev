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
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * M11.2 — one destination row in the bulk-upsert payload. Combined
 * with the request-level (templateId, nationalityCountryId, visaTypeId)
 * the service computes the unique binding identity per row.
 */
export class BulkUpsertDestinationItem {
  @ApiProperty()
  @IsString()
  @IsUUID()
  destinationCountryId: string;

  /**
   * `true` → upsert (create or revive + update). `false` → soft-delete
   * any existing binding for this combo (no-op if missing). The single
   * boolean keeps the wire shape simple — admin doesn't need separate
   * "delete" semantics on the client.
   */
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  governmentFeeAmount: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceFeeAmount: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currencyCode: string;

  @ApiProperty()
  @IsBoolean()
  expeditedEnabled: boolean;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  expeditedFeeAmount?: number;

  /**
   * M11.3 — minimum advance days for arrival date on this binding.
   * Optional in the bulk-upsert payload; when omitted, existing rows
   * keep their value and new rows default to 3.
   */
  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minArrivalDaysAdvance?: number;
}

export class BulkUpsertDestinationsDto {
  @ApiProperty({ description: 'Nationality scope for the fee rows in this batch' })
  @IsString()
  @IsUUID()
  nationalityCountryId: string;

  @ApiProperty({ description: 'Visa type scope — every binding in the batch shares this' })
  @IsString()
  @IsUUID()
  visaTypeId: string;

  @ApiProperty({ type: [BulkUpsertDestinationItem] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkUpsertDestinationItem)
  destinations: BulkUpsertDestinationItem[];
}

export class BulkUpsertDestinationsResponseDto {
  @ApiProperty({ description: 'Number of bindings newly created in this call' })
  created: number;

  @ApiProperty({ description: 'Number of bindings updated (existing rows touched)' })
  updated: number;

  @ApiProperty({ description: 'Number of bindings soft-deleted (isActive=false on input)' })
  deleted: number;

  @ApiProperty({ description: 'Number of input rows skipped because they were already inactive' })
  skipped: number;
}
