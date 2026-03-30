import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

/**
 * UsersController - Skeleton for user management endpoints
 * Will be implemented in future stages
 *
 * Planned endpoints:
 * - GET /users - List users
 * - GET /users/:id - Get user by ID
 * - POST /users - Create user
 * - PATCH /users/:id - Update user
 * - DELETE /users/:id - Soft delete user
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: Implement list users endpoint
  // TODO: Implement get user by ID endpoint
  // TODO: Implement create user endpoint
  // TODO: Implement update user endpoint
  // TODO: Implement delete user endpoint
}
