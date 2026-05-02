import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  RoleListResponseDto,
  GetRolesQueryDto,
} from './dto';
import { RequirePermissions, CurrentUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';
import { AuthenticatedUser } from '@/common/types';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, type: RoleListResponseDto })
  async findAll(@Query() query: GetRolesQueryDto): Promise<RoleListResponseDto> {
    return this.rolesService.findAll(query);
  }

  @Get(':roleId')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findById(@Param('roleId') roleId: string): Promise<RoleResponseDto> {
    return this.rolesService.findById(roleId);
  }

  @Post()
  @RequirePermissions('roles.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create role',
    description:
      'Create a new role. `isSystem` is forced to false on this endpoint — system roles can only be seeded via prisma/seed.ts.',
  })
  @ApiResponse({ status: 201, type: RoleResponseDto })
  @ApiResponse({ status: 409, description: 'Role key or name already exists' })
  async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoleResponseDto> {
    return this.rolesService.create(dto, currentUser.id);
  }

  @Patch(':roleId')
  @RequirePermissions('roles.update')
  @ApiOperation({
    summary: 'Update role',
    description:
      'Update role details. System roles (superAdmin / admin / operator) cannot be renamed — their `key` is referenced in code at runtime, but `name` and `description` stay editable.',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Key conflict, or system role rename attempt' })
  async update(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(roleId, dto, currentUser.id);
  }

  @Delete(':roleId')
  @RequirePermissions('roles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete role',
    description: 'Soft delete a role. Cannot delete system roles or roles with active users.',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete system role' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Role has active users' })
  async delete(
    @Param('roleId') roleId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.rolesService.delete(roleId, currentUser.id);
  }
}
