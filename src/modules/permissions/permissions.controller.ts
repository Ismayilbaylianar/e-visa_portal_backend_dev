import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  PermissionListResponseDto,
  PermissionMatrixResponseDto,
  UpdateRolePermissionsDto,
  UpdateRolePermissionsResponseDto,
  UpdateUserPermissionsDto,
  UpdateUserPermissionsResponseDto,
} from './dto';
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permissions.read')
  @ApiOperation({
    summary: 'Get all permissions',
    description: 'Get list of all available permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of permissions',
    type: PermissionListResponseDto,
  })
  async findAll(): Promise<PermissionListResponseDto> {
    return this.permissionsService.findAll();
  }

  @Get('matrix')
  @RequirePermissions('permissions.read')
  @ApiOperation({
    summary: 'Get permission matrix',
    description: 'Get permissions grouped by module with role assignments for UI display',
  })
  @ApiResponse({
    status: 200,
    description: 'Permission matrix',
    type: PermissionMatrixResponseDto,
  })
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    return this.permissionsService.getMatrix();
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermissions('permissions.update')
  @ApiOperation({
    summary: 'Update role permissions',
    description: 'Replace all permissions for a role with the provided list',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role permissions updated',
    type: UpdateRolePermissionsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Role or permission not found',
  })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<UpdateRolePermissionsResponseDto> {
    return this.permissionsService.updateRolePermissions(roleId, dto);
  }

  @Patch('users/:userId/permissions')
  @RequirePermissions('permissions.update')
  @ApiOperation({
    summary: 'Update user permission overrides',
    description: 'Set user-level permission grants and denies that override role permissions',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User permissions updated',
    type: UpdateUserPermissionsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User or permission not found',
  })
  async updateUserPermissions(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserPermissionsDto,
  ): Promise<UpdateUserPermissionsResponseDto> {
    return this.permissionsService.updateUserPermissions(userId, dto);
  }
}
