import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * UsersService - Skeleton for user management logic
 * Will be implemented in future stages
 *
 * Planned features:
 * - Create user
 * - Get user by ID
 * - Get user by email
 * - Update user
 * - Soft delete user
 * - List users with pagination
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: Implement create user
  // TODO: Implement find by ID
  // TODO: Implement find by email
  // TODO: Implement update user
  // TODO: Implement soft delete
  // TODO: Implement list with pagination
}
