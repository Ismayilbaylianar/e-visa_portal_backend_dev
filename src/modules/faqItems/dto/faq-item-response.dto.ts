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

  /**
   * M11.7 (C1) — Optional human-readable label resolved from the
   * `faq_categories` lookup. Falls back client-side when missing so
   * legacy items without a registered category still render.
   */
  @ApiPropertyOptional({ description: 'Display name from faq_categories.display_name' })
  displayName?: string;

  @ApiProperty({ type: [FaqGroupedItemDto] })
  items: FaqGroupedItemDto[];
}

export class FaqGroupedResponseDto {
  @ApiProperty({ type: [FaqGroupDto] })
  groups: FaqGroupDto[];
}

/** M11.7 (C1) — Admin response shape for /admin/faq-categories. */
export class FaqCategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'general' }) key: string;
  @ApiProperty({ example: 'General Questions' }) displayName: string;
  @ApiProperty() displayOrder: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  /**
   * M11.14 (BUG SS) — number of FAQ items that currently reference
   * this category via `faq_items.category = key`. Only populated on
   * the list endpoint (the admin page renders it; the customer-form
   * dropdown ignores it).
   */
  @ApiPropertyOptional()
  faqCount?: number;
  /**
   * M11.14 (BUG SS) — the seeded canonical categories
   * (general, visa, application, payment, support, other) are
   * system-protected: rename + reorder allowed, delete blocked.
   * Computed by the service from the migration's seed list — there's
   * no DB column for it because the seed is the source of truth.
   */
  @ApiPropertyOptional()
  isSystem?: boolean;
}

export class FaqCategoryListResponseDto {
  @ApiProperty({ type: [FaqCategoryResponseDto] })
  items: FaqCategoryResponseDto[];

  @ApiProperty()
  total: number;
}

/** M11.14 (BUG SS) — Delete result with reassignment count. */
export class FaqCategoryDeleteResultDto {
  @ApiProperty() success: boolean;
  @ApiProperty({
    description:
      'Number of FAQ items that were moved to the "general" category as part of a force-delete.',
  })
  reassignedFaqs: number;
}
