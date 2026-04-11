import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PublicSelectionService } from './public-selection.service';
import { Public } from '@/common/decorators';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
} from './dto';

@ApiTags('Public Selection')
@Controller('public/selection')
export class PublicSelectionController {
  constructor(private readonly publicSelectionService: PublicSelectionService) {}

  @Get('options')
  @Public()
  @ApiOperation({
    summary: 'Get selection options',
    description:
      'Get available destination countries, nationality countries, and visa types for application selection. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Selection options including destination countries, nationality countries, and visa types',
    type: SelectionOptionsResponseDto,
  })
  async getOptions(): Promise<SelectionOptionsResponseDto> {
    return this.publicSelectionService.getOptions();
  }

  @Post('preview')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get fee preview',
    description:
      'Get fee breakdown and eligibility for a specific nationality, destination, and visa type combination. Returns binding ID and template ID if eligible. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fee preview with binding and template information',
    type: SelectionPreviewResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No valid binding found for this combination (bindingNotFound)',
  })
  async getPreview(@Body() dto: SelectionPreviewRequestDto): Promise<SelectionPreviewResponseDto> {
    return this.publicSelectionService.getPreview(dto);
  }
}
