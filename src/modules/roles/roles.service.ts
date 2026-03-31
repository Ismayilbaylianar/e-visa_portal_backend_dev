import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  GetRolesQueryDto,
} from './dto';
import { NotFoundException, ConflictException, BadRequestException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetRolesQueryDto,
  ): Promise<{ items: RoleResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isSystem !== undefined && { isSystem: query.isSystem }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { key: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.role.count({ where }),
    ]);

    const items = roles.map(role => this.mapToResponse(role));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return this.mapToResponse(role);
  }

  async create(dto: CreateRoleDto): Promise<RoleResponseDto> {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        OR: [{ key: dto.key }, { name: dto.name }],
        deletedAt: null,
      },
    });

    if (existingRole) {
      if (existingRole.key === dto.key) {
        throw new ConflictException('Role with this key already exists');
      }
      throw new ConflictException('Role with this name already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        isSystem: dto.isSystem ?? false,
      },
    });

    this.logger.log(`Role created: ${role.id}`);
    return this.mapToResponse(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.key && dto.key !== role.key) {
      const existingRole = await this.prisma.role.findFirst({
        where: { key: dto.key, deletedAt: null, NOT: { id } },
      });
      if (existingRole) {
        throw new ConflictException('Role with this key already exists');
      }
    }

    if (dto.name && dto.name !== role.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: { name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (existingRole) {
        throw new ConflictException('Role with this name already exists');
      }
    }

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Role updated: ${id}`);
    return this.mapToResponse(updatedRole);
  }

  async delete(id: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    const usersWithRole = await this.prisma.user.count({
      where: { roleId: id, deletedAt: null },
    });

    if (usersWithRole > 0) {
      throw new BadRequestException(
        `Cannot delete role: ${usersWithRole} user(s) are assigned to this role`,
      );
    }

    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Role deleted: ${id}`);
  }

  private mapToResponse(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description || undefined,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
