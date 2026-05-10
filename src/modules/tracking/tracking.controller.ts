import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { TrackApplicationDto, BookingTrackingResponseDto } from './dto';

@ApiTags('Tracking - Public')
@Controller('public/tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track application status',
    description:
      'M11.10 — accepts EITHER an APP-YYYY-NNNNNN applicant code OR a REF-YYYY-NNNNNN booking reference. Returns the booking with every applicant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking tracking information (booking + every applicant)',
    type: BookingTrackingResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Application not found',
  })
  async search(@Body() dto: TrackApplicationDto): Promise<BookingTrackingResponseDto> {
    return this.trackingService.search(dto);
  }
}
