import { ApiProperty } from '@nestjs/swagger';

/**
 * Blast radius for deleting one binding, rendered in the row-level
 * confirmation dialog. Counted server-side for the same reason as the
 * whole-template variant: the admin should be agreeing to the
 * database's numbers, not to whatever the list happened to have cached.
 */
export class DeleteBindingPreviewDto {
  @ApiProperty() bindingId!: string;
  @ApiProperty() destinationCountryName!: string;
  @ApiProperty() destinationCountryIso!: string;
  @ApiProperty() visaTypeName!: string;
  @ApiProperty() templateName!: string;
  @ApiProperty({ description: 'Live nationality fee rows that would be soft-deleted' })
  feeCount!: number;
  @ApiProperty({ description: 'Distinct nationalities losing pricing' })
  nationalityCount!: number;
  @ApiProperty({ description: 'Distinct entries priced under this binding' })
  entryCount!: number;
  @ApiProperty({
    description:
      'Applications referencing this binding. Preserved — the row survives soft-deleted so they keep rendering.',
  })
  applicationCount!: number;
}

/** Result of deleting one binding. */
export class DeleteBindingResponseDto {
  @ApiProperty({
    description:
      'False when the binding was already deleted — the idempotent no-op case.',
  })
  deletedBinding!: boolean;
  @ApiProperty({ description: 'Nationality fee rows soft-deleted by this call' })
  deletedFees!: number;
  @ApiProperty({ description: 'Applications left untouched' })
  preservedApplications!: number;
}
