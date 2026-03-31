import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  PermissionResponseDto,
  PermissionMatrixResponseDto,
  RolePermissionMatrixDto,
  UpdateRolePermissionsDto,
  UpdateUserPermissionsDto,
} from './dto';
import { RoleIdParamDto, UserIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@Controller('admin/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all permissions',
    description: 'Get list of all available permissions',
  })
  @ApiPaginatedResponse(PermissionResponseDto)
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get('matrix')
  @ApiOperation({
    summary: 'Get permission matrix',
    description:
      'Get permissions grouped by module with role assignments for matrix view',
  })
  @ApiResponse({
    status: 200,
    description: 'Permission matrix',
    type: PermissionMatrixResponseDto,
  })
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    return this.permissionsService.getMatrix();
  }

  @Patch('/roles/:roleId/permissions')
  @ApiOperation({
    summary: 'Update role permissions',
    description: 'Replace all permissions for a role',
  })
  @ApiResponse({
    status: 200,
    description: 'Role permissions updated successfully',
    type: RolePermissionMatrixDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Role or permission not found',
  })
  async updateRolePermissions(
    @Param() params: RoleIdParamDto,
    @Body() dto: UpdateRolePermissionsDto,
  ): Promise<RolePermissionMatrixDto> {
    return this.permissionsService.updateRolePermissions(params.roleId, dto);
  }

  @Patch('/users/:userId/permissions')
  @ApiOperation({
    summary: 'Update user permissions',
    description:
      'Set user-specific permission overrides (ALLOW/DENY) that take precedence over role permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'User permissions updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User or permission not found',
  })
  async updateUserPermissions(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserPermissionsDto,
  ) {
    return this.permissionsService.updateUserPermissions(params.userId, dto);
  }
}
