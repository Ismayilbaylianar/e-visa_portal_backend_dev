import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  RoleListResponseDto,
  GetRolesQueryDto,
} from './dto';
import { NotFoundException, ConflictException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of roles
   */
  async findAll(query: GetRolesQueryDto): Promise<RoleListResponseDto> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.isSystem !== undefined) {
      where.isSystem = query.isSystem;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          _count: {
            select: { users: { where: { deletedAt: null } } },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.role.count({ where }),
    ]);

    const items = roles.map(role => this.mapToResponse(role));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get role by ID
   */
  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(role);
  }

  /**
   * Create new role
   */
  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    // Check if key already exists
    const existingByKey = await this.prisma.role.findFirst({
      where: { key: dto.key },
    });

    if (existingByKey) {
      throw new ConflictException('Role key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A role with this key already exists',
        },
      ]);
    }

    // Check if name already exists
    const existingByName = await this.prisma.role.findFirst({
      where: { name: dto.name },
    });

    if (existingByName) {
      throw new ConflictException('Role name already exists', [
        {
          field: 'name',
          reason: ErrorCodes.CONFLICT,
          message: 'A role with this name already exists',
        },
      ]);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        isSystem: dto.isSystem ?? false,
      },
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
      },
    });

    this.logger.log(`Role created: ${role.id} (${role.key})`);
    return this.mapToResponse(role);
  }

  /**
   * Update role
   */
  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    // Check key uniqueness if changing
    if (dto.key && dto.key !== role.key) {
      const existingByKey = await this.prisma.role.findFirst({
        where: { key: dto.key },
      });
      if (existingByKey) {
        throw new ConflictException('Role key already exists', [
          {
            field: 'key',
            reason: ErrorCodes.CONFLICT,
            message: 'A role with this key already exists',
          },
        ]);
      }
    }

    // Check name uniqueness if changing
    if (dto.name && dto.name !== role.name) {
      const existingByName = await this.prisma.role.findFirst({
        where: { name: dto.name },
      });
      if (existingByName) {
        throw new ConflictException('Role name already exists', [
          {
            field: 'name',
            reason: ErrorCodes.CONFLICT,
            message: 'A role with this name already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.key) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
      },
    });

    this.logger.log(`Role updated: ${id}`);
    return this.mapToResponse(updatedRole);
  }

  /**
   * Soft delete role
   */
  async delete(id: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { users: { where: { deletedAt: null } } },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    // Prevent deletion of system roles
    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system role', [
        { reason: ErrorCodes.FORBIDDEN, message: 'System roles cannot be deleted' },
      ]);
    }

    // Prevent deletion if role has active users
    if (role._count.users > 0) {
      throw new ConflictException('Role has active users', [
        {
          reason: ErrorCodes.CONFLICT,
          message: `Cannot delete role with ${role._count.users} active user(s). Reassign users first.`,
        },
      ]);
    }

    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Role soft deleted: ${id}`);
  }

  /**
   * Map role entity to response DTO
   */
  private mapToResponse(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description || undefined,
      isSystem: role.isSystem,
      userCount: role._count?.users ?? 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
