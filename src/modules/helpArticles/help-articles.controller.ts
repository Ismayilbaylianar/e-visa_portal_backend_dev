import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { HelpArticlesService } from './help-articles.service';
import {
  CreateHelpArticleDto,
  CreateHelpCategoryDto,
  HelpArticleDetailDto,
  HelpArticleImageResponseDto,
  HelpArticleListItemDto,
  HelpCategoryDeleteResultDto,
  HelpCategoryResponseDto,
  ListHelpArticlesQueryDto,
  ReorderHelpArticlesDto,
  UpdateHelpArticleDto,
  UpdateHelpCategoryDto,
  UpdateHelpImageDto,
} from './dto';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * M11.15 (HELP) — admin endpoints for the operator help / training
 * system. Two permissions decide what shows up:
 *
 *   help.read   — every logged-in role can list + view published
 *                 articles whose `visible_to_roles` includes their
 *                 role key.
 *   help.manage — admin + superAdmin can create, edit, delete, and
 *                 see unpublished drafts (`?includeDrafts=true`).
 */
@ApiTags('Help Articles (Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/help')
export class HelpArticlesAdminController {
  constructor(private readonly service: HelpArticlesService) {}

  // ───────────── Categories ─────────────

  @Get('categories')
  @RequirePermissions('help.read')
  @ApiOperation({ summary: 'List help categories with article counts' })
  @ApiResponse({ status: 200, type: [HelpCategoryResponseDto] })
  async listCategories(): Promise<HelpCategoryResponseDto[]> {
    return this.service.listCategories();
  }

  @Post('categories')
  @RequirePermissions('help.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a help category' })
  @ApiResponse({ status: 201, type: HelpCategoryResponseDto })
  async createCategory(
    @Body() dto: CreateHelpCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpCategoryResponseDto> {
    return this.service.createCategory(
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Patch('categories/:id')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Rename / reorder a help category' })
  @ApiResponse({ status: 200, type: HelpCategoryResponseDto })
  async updateCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHelpCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpCategoryResponseDto> {
    return this.service.updateCategory(
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Delete('categories/:id')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Soft-delete a help category (force-reassigns articles)',
    description:
      'System categories cannot be deleted. User-created categories with attached articles need ?force=true; the service moves articles to "getting-started" before soft-deleting.',
  })
  @ApiResponse({ status: 200, type: HelpCategoryDeleteResultDto })
  async deleteCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('force') force: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpCategoryDeleteResultDto> {
    return this.service.deleteCategory(
      id,
      force === 'true',
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  // ───────────── Articles ─────────────

  @Get('articles')
  @RequirePermissions('help.read')
  @ApiOperation({
    summary: 'List help articles for the caller’s role',
    description:
      'Filters by visibility (role match), optional category key, optional search term. includeDrafts=true requires help.manage.',
  })
  @ApiResponse({ status: 200, type: [HelpArticleListItemDto] })
  async listArticles(
    @Query() query: ListHelpArticlesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HelpArticleListItemDto[]> {
    const roleKey = user.roleKey ?? 'operator';
    const canManage = (user.permissions ?? []).includes('help.manage');
    return this.service.listArticles(query, roleKey, canManage);
  }

  /**
   * Reorder MUST be declared before `:slug` so Nest doesn't route
   * `articles/reorder` into the by-slug handler.
   */
  @Post('articles/reorder')
  @RequirePermissions('help.manage')
  @ApiOperation({ summary: 'Bulk-update sortOrder by id list' })
  @ApiResponse({ status: 200 })
  async reorderArticles(
    @Body() dto: ReorderHelpArticlesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: true; updated: number }> {
    return this.service.reorderArticles(dto, user.id);
  }

  @Get('articles/:slug')
  @RequirePermissions('help.read')
  @ApiParam({ name: 'slug' })
  @ApiResponse({ status: 200, type: HelpArticleDetailDto })
  async getArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HelpArticleDetailDto> {
    const roleKey = user.roleKey ?? 'operator';
    const canManage = (user.permissions ?? []).includes('help.manage');
    return this.service.getArticleBySlug(slug, roleKey, canManage);
  }

  @Post('articles')
  @RequirePermissions('help.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, type: HelpArticleDetailDto })
  async createArticle(
    @Body() dto: CreateHelpArticleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpArticleDetailDto> {
    return this.service.createArticle(
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Patch('articles/:id')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: HelpArticleDetailDto })
  async updateArticle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateHelpArticleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpArticleDetailDto> {
    return this.service.updateArticle(
      id,
      dto,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Delete('articles/:id')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArticle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.deleteArticle(
      id,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  // ───────────── Images ─────────────

  /**
   * M11.15-HELP-V2 — Inline image upload for the TipTap editor. The
   * editor calls this from its toolbar / drag-drop / paste handlers
   * and inserts the returned `url` directly into the article HTML;
   * no row in help_article_images is created.
   *
   * `id` may be the article uuid OR the literal string `draft` when
   * the editor is on the "new article" page and hasn't created the
   * row yet — both shapes are accepted so the editor doesn't have
   * to save a placeholder first.
   */
  @Post('articles/:id/inline-images')
  @RequirePermissions('help.manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201 })
  @HttpCode(HttpStatus.CREATED)
  async uploadInlineImage(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ url: string; alt: string }> {
    return this.service.uploadInlineImage(id, file, user.id);
  }

  @Post('articles/:id/images')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
        altText: { type: 'string' },
        sortOrder: { type: 'integer' },
      },
    },
  })
  @ApiResponse({ status: 201, type: HelpArticleImageResponseDto })
  async uploadImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MulterFile,
    @Body('caption') caption: string | undefined,
    @Body('altText') altText: string | undefined,
    @Body('sortOrder') sortOrder: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<HelpArticleImageResponseDto> {
    const order =
      sortOrder !== undefined && sortOrder !== ''
        ? Number(sortOrder)
        : undefined;
    return this.service.uploadImage(
      id,
      file,
      caption,
      altText,
      Number.isFinite(order) ? (order as number) : undefined,
      user.id,
      req.ip,
      req.get('user-agent') ?? undefined,
    );
  }

  @Patch('articles/:id/images/:imageId')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'imageId' })
  @ApiResponse({ status: 200, type: HelpArticleImageResponseDto })
  async updateImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @Body() dto: UpdateHelpImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HelpArticleImageResponseDto> {
    return this.service.updateImage(id, imageId, dto, user.id);
  }

  @Delete('articles/:id/images/:imageId')
  @RequirePermissions('help.manage')
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'imageId' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.deleteImage(id, imageId, user.id);
  }
}
