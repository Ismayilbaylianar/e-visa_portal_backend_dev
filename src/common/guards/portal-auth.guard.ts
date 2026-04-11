import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PortalAuthService } from '@/modules/portalAuth/portal-auth.service';
import { UnauthorizedException } from '../exceptions';
import { ErrorCodes } from '../constants';

/**
 * Portal Authentication Guard
 * Validates portal identity tokens for customer portal routes
 */
@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(PortalAuthService) private portalAuthService: PortalAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided', [
        { reason: ErrorCodes.UNAUTHORIZED, message: 'Authorization header is required' },
      ]);
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header format', [
        {
          reason: ErrorCodes.UNAUTHORIZED,
          message: 'Authorization header must be in format: Bearer <token>',
        },
      ]);
    }

    // Validate portal token
    const portalIdentity = await this.portalAuthService.validateAccessToken(token);

    if (!portalIdentity) {
      throw new UnauthorizedException('Invalid or expired token', [
        { reason: ErrorCodes.INVALID_TOKEN, message: 'The access token is invalid or has expired' },
      ]);
    }

    // Attach portal identity to request
    request.portalIdentity = portalIdentity;

    return true;
  }
}
