import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

/**
 * AuthController - Skeleton for authentication endpoints
 * Will be implemented in future stages
 *
 * Planned endpoints:
 * - POST /auth/login
 * - POST /auth/refresh
 * - POST /auth/logout
 * - POST /auth/forgot-password
 * - POST /auth/reset-password
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: Implement login endpoint
  // TODO: Implement refresh endpoint
  // TODO: Implement logout endpoint
  // TODO: Implement forgot-password endpoint
  // TODO: Implement reset-password endpoint
}
