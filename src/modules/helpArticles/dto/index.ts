import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Min,
} from 'class-validator';

/* ---------------------------------------------------------------------------
 * Category DTOs
 * ------------------------------------------------------------------------ */

export class CreateHelpCategoryDto {
  @ApiProperty({
    description: 'Stable URL slug (lowercase letters / digits / dashes)',
    example: 'getting-started',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'key must be lowercase letters / digits with single dashes (e.g. "getting-started")',
  })
  key!: string;

  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Başlanğıc' })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiPropertyOptional({ example: 'Sistem ilə tanışlıq' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'lucide-react icon name (e.g. BookOpen)',
    example: 'BookOpen',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  iconName?: string;

  @ApiPropertyOptional({ minimum: 0, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateHelpCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  iconName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/* ---------------------------------------------------------------------------
 * Article DTOs
 * ------------------------------------------------------------------------ */

const VALID_ROLE_KEYS = ['superAdmin', 'admin', 'operator', 'mini_admin'];

export class CreateHelpArticleDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiPropertyOptional({
    description: 'Auto-generated from title if omitted.',
    minLength: 2,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @Length(2, 150)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters / digits with single dashes',
  })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Plain-text summary shown on list pages.' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({
    description:
      'Markdown source. The service renders to HTML and stores both. Round-tripping the editor uses this field.',
  })
  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @ApiPropertyOptional({
    description:
      'Optional editor-supplied HTML. Wins over markdown when both are present (e.g. TipTap which emits HTML directly).',
  })
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ example: 'https://www.youtube.com/watch?v=abc123' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Role keys allowed to see this article.',
    enum: VALID_ROLE_KEYS,
    isArray: true,
    example: ['operator', 'admin', 'superAdmin'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  visibleToRoles?: string[];
}

export class UpdateHelpArticleDto extends CreateHelpArticleDto {}

export class ListHelpArticlesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Include unpublished articles too (admin authoring view). help.manage required.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDrafts?: boolean;
}

export class ReorderHelpArticlesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

/* ---------------------------------------------------------------------------
 * Image DTOs
 * ------------------------------------------------------------------------ */

export class UpdateHelpImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/* ---------------------------------------------------------------------------
 * Response DTOs
 * ------------------------------------------------------------------------ */

export class HelpCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() iconName?: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isSystem!: boolean;
  @ApiPropertyOptional() articleCount?: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class HelpArticleImageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional() caption?: string | null;
  @ApiPropertyOptional() altText?: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: Date;
}

export class HelpArticleListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiPropertyOptional() categoryKey?: string | null;
  @ApiPropertyOptional() categoryName?: string | null;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() tags!: string[];
  @ApiProperty() viewCount!: number;
  @ApiProperty() hasVideo!: boolean;
  @ApiProperty() imageCount!: number;
  @ApiProperty() visibleToRoles!: string[];
  @ApiProperty() updatedAt!: Date;
}

export class HelpArticleDetailDto extends HelpArticleListItemDto {
  @ApiPropertyOptional() contentHtml?: string | null;
  @ApiPropertyOptional() contentMarkdown?: string | null;
  @ApiPropertyOptional() videoUrl?: string | null;
  @ApiPropertyOptional() videoProvider?: string | null;
  @ApiProperty({ type: [HelpArticleImageResponseDto] }) images!: HelpArticleImageResponseDto[];
  @ApiPropertyOptional() createdBy?: string | null;
  @ApiPropertyOptional() updatedBy?: string | null;
  @ApiProperty() createdAt!: Date;
}

export class HelpCategoryDeleteResultDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() reassignedArticles!: number;
}
