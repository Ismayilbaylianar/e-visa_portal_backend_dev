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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { FaqItemsService } from './faq-items.service';
import {
  CreateFaqItemDto,
  FaqGroupedResponseDto,
  FaqItemListResponseDto,
  FaqItemResponseDto,
  GetFaqItemsQueryDto,
  ReorderFaqItemsDto,
  UpdateFaqItemDto,
} from './dto';
import { CurrentUser, Public, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';

@ApiTags('FAQ Items')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/faq-items')
export class FaqItemsAdminController {
  constructor(private readonly service: FaqItemsService) {}

  @Get()
  @RequirePermissions('content.read')
  @ApiOperation({ summary: 'List FAQ items, optionally filtered by category' })
  @ApiResponse({ status: 200, type: FaqItemListResponseDto })
  async list(@Query() query: GetFaqItemsQueryDto): Promise<FaqItemListResponseDto> {
    return this.service.list(query.category);
  }

  /**
   * Reorder must be declared BEFORE `:id` so Nest doesn't route
   * `/reorder` into the by-id handler.
   */
  @Patch('reorder')
  @RequirePermissions('content.update')
  @ApiOperation({ summary: 'Bulk reorder FAQ items (drag-drop)' })
  @ApiResponse({ status: 200, type: FaqItemListResponseDto })
  async reorder(
    @Body() dto: ReorderFaqItemsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<FaqItemListResponseDto> {
    return this.service.reorder(dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Get(':id')
  @RequirePermissions('content.read')
  @ApiOperation({ summary: 'Get FAQ item by id' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: FaqItemResponseDto })
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FaqItemResponseDto> {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions('content.update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create FAQ item' })
  @ApiResponse({ status: 201, type: FaqItemResponseDto })
  async create(
    @Body() dto: CreateFaqItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<FaqItemResponseDto> {
    return this.service.create(dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Patch(':id')
  @RequirePermissions('content.update')
  @ApiOperation({ summary: 'Update FAQ item' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: FaqItemResponseDto })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFaqItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<FaqItemResponseDto> {
    return this.service.update(id, dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }

  @Delete(':id')
  @RequirePermissions('content.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete FAQ item' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204 })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.softDelete(id, user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}

@ApiTags('FAQ Items - Public')
@Controller('public/faq-items')
export class FaqItemsPublicController {
  constructor(private readonly service: FaqItemsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public FAQ — items grouped by category, published only' })
  @ApiResponse({ status: 200, type: FaqGroupedResponseDto })
  async listGrouped(): Promise<FaqGroupedResponseDto> {
    return this.service.listPublishedGrouped();
  }
}
