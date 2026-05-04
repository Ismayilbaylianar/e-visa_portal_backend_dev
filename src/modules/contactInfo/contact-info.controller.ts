import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ContactInfoService } from './contact-info.service';
import { ContactInfoResponseDto, UpdateContactInfoDto } from './dto';
import { CurrentUser, Public, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import type { AuthenticatedUser } from '@/common/types';

@ApiTags('Contact Info')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/contact-info')
export class ContactInfoAdminController {
  constructor(private readonly service: ContactInfoService) {}

  @Get()
  @RequirePermissions('content.read')
  @ApiOperation({ summary: 'Get contact info (admin)' })
  @ApiResponse({ status: 200, type: ContactInfoResponseDto })
  async get(): Promise<ContactInfoResponseDto> {
    return this.service.get();
  }

  @Patch()
  @RequirePermissions('content.update')
  @ApiOperation({ summary: 'Update contact info (singleton)' })
  @ApiResponse({ status: 200, type: ContactInfoResponseDto })
  async update(
    @Body() dto: UpdateContactInfoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ContactInfoResponseDto> {
    return this.service.update(dto, user.id, req.ip, req.get('user-agent') ?? undefined);
  }
}

@ApiTags('Contact Info - Public')
@Controller('public/contact-info')
export class ContactInfoPublicController {
  constructor(private readonly service: ContactInfoService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get the public contact info' })
  @ApiResponse({ status: 200, type: ContactInfoResponseDto })
  async get(): Promise<ContactInfoResponseDto> {
    return this.service.get();
  }
}
