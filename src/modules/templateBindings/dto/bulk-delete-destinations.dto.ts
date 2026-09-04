import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Request body for deleting every destination binding under a template.
 *
 * `expectedBindingCount` is a concurrency guard, not decoration. The
 * admin confirms against counts rendered from a preview call; if
 * somebody adds or removes a destination in between, those counts are
 * stale and the admin would be destroying more than they agreed to.
 * When the number is supplied and does not match what the transaction
 * actually finds, the request is rejected and the dialog has to be
 * reopened against fresh numbers.
 */
export class BulkDeleteDestinationsDto {
  @ApiPropertyOptional({
    description:
      'Number of live bindings the admin was shown in the confirmation dialog. Rejected with 409 if it no longer matches.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedBindingCount?: number;
}

/** Per-destination line in the pre-delete preview. */
export class BulkDeleteDestinationItemDto {
  @ApiProperty() bindingId!: string;
  @ApiProperty() destinationCountryId!: string;
  @ApiProperty() destinationCountryName!: string;
  @ApiProperty() destinationCountryIso!: string;
  @ApiProperty() visaTypeId!: string;
  @ApiProperty() visaTypeName!: string;
  @ApiProperty() feeCount!: number;
  @ApiProperty() nationalityCount!: number;
  @ApiProperty() applicationCount!: number;
}

/**
 * What the confirmation dialog renders. Computed server-side so the
 * numbers the admin agrees to are the numbers the database will act
 * on — the browser is not trusted to tally its own blast radius.
 */
export class BulkDeleteDestinationsPreviewDto {
  @ApiProperty() templateId!: string;
  @ApiProperty() templateName!: string;
  @ApiProperty({ description: 'Live bindings that would be soft-deleted' })
  bindingCount!: number;
  @ApiProperty({ description: 'Live nationality fee rows that would be soft-deleted' })
  feeCount!: number;
  @ApiProperty({ description: 'Distinct nationalities losing pricing' })
  nationalityCount!: number;
  @ApiProperty({ description: 'Distinct destination countries in scope' })
  destinationCount!: number;
  @ApiProperty({
    description:
      'Applications referencing these bindings. They are preserved — the binding row survives soft-deleted so they keep rendering.',
  })
  applicationCount!: number;
  @ApiProperty({ type: [BulkDeleteDestinationItemDto] })
  destinations!: BulkDeleteDestinationItemDto[];
}

/** Result of the delete itself. */
export class BulkDeleteDestinationsResponseDto {
  @ApiProperty({ description: 'Bindings soft-deleted by this call' })
  deletedBindings!: number;
  @ApiProperty({ description: 'Nationality fee rows soft-deleted by this call' })
  deletedFees!: number;
  @ApiProperty({ description: 'Distinct nationalities affected' })
  affectedNationalities!: number;
  @ApiProperty({ description: 'Distinct destination countries affected' })
  affectedDestinations!: number;
  @ApiProperty({
    description:
      'Applications that referenced the deleted bindings. Untouched — reported so the caller can see the history it kept.',
  })
  preservedApplications!: number;
}
