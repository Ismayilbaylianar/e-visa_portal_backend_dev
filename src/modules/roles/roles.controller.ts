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
import { RequirePermissions } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Get paginated list of roles with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of roles',
    type: RoleListResponseDto,
  })
  async findAll(@Query() query: GetRolesQueryDto): Promise<RoleListResponseDto> {
    return this.rolesService.findAll(query);
  }

  @Get(':roleId')
  @RequirePermissions('roles.read')
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Get role details by ID',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role details',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async findById(@Param('roleId') roleId: string): Promise<RoleResponseDto> {
    return this.rolesService.findById(roleId);
  }

  @Post()
  @RequirePermissions('roles.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create role',
    description: 'Create a new role',
  })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Role key or name already exists',
  })
  async create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto);
  }

  @Patch(':roleId')
  @RequirePermissions('roles.update')
  @ApiOperation({
    summary: 'Update role',
    description: 'Update role details',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Role key or name already exists',
  })
  async update(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(roleId, dto);
  }

  @Delete(':roleId')
  @RequirePermissions('roles.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete role',
    description: 'Soft delete a role. Cannot delete system roles or roles with active users.',
  })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiResponse({
    status: 204,
    description: 'Role deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot delete system role',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Role has active users',
  })
  async delete(@Param('roleId') roleId: string): Promise<void> {
    return this.rolesService.delete(roleId);
  }
}
