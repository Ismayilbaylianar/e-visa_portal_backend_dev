import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogResponseDto, GetAuditLogsQueryDto } from './dto';
import { AuditLogIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@Controller('admin/auditLogs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all audit logs',
    description: 'Get paginated list of audit logs with optional filters',
  })
  @ApiPaginatedResponse(AuditLogResponseDto)
  async findAll(@Query() query: GetAuditLogsQueryDto) {
    return this.auditLogsService.findAll(query);
  }

  @Get(':auditLogId')
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
