import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerPortalService } from './customer-portal.service';
import { MyApplicationsResponseDto } from './dto';
import { PortalAuthGuard } from '@/common/guards';
import { CurrentPortalIdentity } from '@/common/decorators';
import { PortalIdentityUser } from '@/common/types';

@ApiTags('Customer Portal')
@ApiBearerAuth('Portal-auth')
@UseGuards(PortalAuthGuard)
@Controller('portal/me')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Get('applications')
  @ApiOperation({
    summary: 'Get my applications',
    description: 'Get all applications for the current authenticated portal user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of user applications',
    type: MyApplicationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMyApplications(
    @CurrentPortalIdentity() portalIdentity: PortalIdentityUser,
  ): Promise<MyApplicationsResponseDto> {
    return this.customerPortalService.getMyApplications(portalIdentity.id);
  }
}
