import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FaqItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  answer: string;

  @ApiPropertyOptional({ example: 'general' })
  category?: string;

  @ApiProperty({ description: 'Per-category sort key' })
  displayOrder: number;

  @ApiProperty()
  isPublished: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FaqItemListResponseDto {
  @ApiProperty({ type: [FaqItemResponseDto] })
  items: FaqItemResponseDto[];

  @ApiProperty()
  total: number;
}

/** Public response — items grouped by category for the accordion UI. */
export class FaqGroupedItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  answer: string;

  @ApiProperty()
  displayOrder: number;
}

export class FaqGroupDto {
  @ApiProperty({ description: '"general" / "application" / etc. — null group is "Other".' })
  category: string;

  @ApiProperty({ type: [FaqGroupedItemDto] })
  items: FaqGroupedItemDto[];
}

export class FaqGroupedResponseDto {
  @ApiProperty({ type: [FaqGroupDto] })
  groups: FaqGroupDto[];
}
