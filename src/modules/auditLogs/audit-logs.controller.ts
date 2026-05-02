import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogResponseDto, GetAuditLogsQueryDto } from './dto';
import { AuditLogIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse, RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/auditLogs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions('auditLogs.read')
  @ApiOperation({
    summary: 'Get all audit logs',
    description:
      'Get paginated list of audit logs with optional filters. Sensitive — leaks who-did-what across the entire admin surface, so the seed restricts this to admin + superAdmin (operator role excluded).',
  })
  @ApiPaginatedResponse(AuditLogResponseDto)
  async findAll(@Query() query: GetAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get(':auditLogId')
  @RequirePermissions('auditLogs.read')
  @ApiOperation({
    summary: 'Get audit log by ID',
    description: 'Get audit log details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log details',
    type: AuditLogResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log not found',
  })
  async findById(@Param() params: AuditLogIdParamDto): Promise<AuditLogResponseDto> {
    return this.auditLogsService.findById(params.auditLogId);
  }
}
