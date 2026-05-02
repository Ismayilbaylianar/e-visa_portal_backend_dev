import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import {
  PermissionListResponseDto,
  PermissionMatrixResponseDto,
  UpdateRolePermissionsDto,
  UpdateRolePermissionsResponseDto,
  UpdateUserPermissionsDto,
  UpdateUserPermissionsResponseDto,
  UserEffectivePermissionsResponseDto,
} from './dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, type: PermissionListResponseDto })
  async findAll(): Promise<PermissionListResponseDto> {
    return this.permissionsService.findAll();
  }

  @Get('matrix')
  @RequirePermissions('permissions.read')
  @ApiOperation({
    summary: 'Get permission matrix',
    description: 'Get permissions grouped by module with role assignments for UI display',
  })
  @ApiResponse({ status: 200, type: PermissionMatrixResponseDto })
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    return this.permissionsService.getMatrix();
  }

  @Get('users/:userId')
  @RequirePermissions('permissions.read')
  @ApiOperation({
    summary: 'Get effective permissions for a user',
    description:
      'Per-permission breakdown: role contribution + user override + effective state. Used to render the granular override matrix UI (Modul 6b 3-state radio).',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, type: UserEffectivePermissionsResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserEffectivePermissions(
    @Param('userId') userId: string,
  ): Promise<UserEffectivePermissionsResponseDto> {
    return this.permissionsService.getUserEffectivePermissions(userId);
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermissions('permissions.update')
  @ApiOperation({
    summary: 'Update role permissions',
    description:
      'Replace all permissions for a role. The super-admin role permission set is locked — stripping permissions from it would silently break the org.',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, type: UpdateRolePermissionsResponseDto })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  @ApiResponse({ status: 409, description: 'Super-admin role permission set is locked' })
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UpdateRolePermissionsResponseDto> {
    return this.permissionsService.updateRolePermissions(roleId, dto, currentUser.id);
  }

  @Patch('users/:userId/permissions')
  @RequirePermissions('permissions.update')
  @ApiOperation({
    summary: 'Update user permission overrides',
    description:
      'Set user-level permission grants and denies that override role permissions. Super-admin user overrides are locked — DENY on a super admin would silently strip god-mode.',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, type: UpdateUserPermissionsResponseDto })
  @ApiResponse({ status: 404, description: 'User or permission not found' })
  @ApiResponse({ status: 409, description: 'Super-admin user override is locked' })
  async updateUserPermissions(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UpdateUserPermissionsResponseDto> {
    return this.permissionsService.updateUserPermissions(userId, dto, currentUser.id);
  }
}
