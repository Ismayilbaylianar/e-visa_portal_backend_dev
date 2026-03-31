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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  GetRolesQueryDto,
} from './dto';
import { RoleIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Get paginated list of roles with optional filters',
  })
  @ApiPaginatedResponse(RoleResponseDto)
  async findAll(@Query() query: GetRolesQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':roleId')
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Get role details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Role details',
    type: RoleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async findById(@Param() params: RoleIdParamDto): Promise<RoleResponseDto> {
    return this.rolesService.findById(params.roleId);
  }

  @Post()
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
    description: 'Role with this key or name already exists',
  })
  async create(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto);
  }

  @Patch(':roleId')
  @ApiOperation({
    summary: 'Update role',
    description: 'Update role details',
  })
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
    description: 'Role with this key or name already exists',
  })
  async update(
    @Param() params: RoleIdParamDto,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(params.roleId, dto);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete role',
    description: 'Soft delete a role (system roles cannot be deleted)',
  })
  @ApiResponse({
    status: 204,
    description: 'Role deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'System roles cannot be deleted or role has assigned users',
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found',
  })
  async delete(@Param() params: RoleIdParamDto): Promise<void> {
    return this.rolesService.delete(params.roleId);
  }
}
