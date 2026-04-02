import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/modules/prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roleId?: string;
  roleKey?: string;
  sessionId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roleId?: string;
  roleKey?: string;
  sessionId: string;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('app.jwt.accessSecret') || 'default-secret';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user exists and is active
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
        isActive: true,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify session is valid
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Build permissions list
    const rolePermissions = user.role?.rolePermissions.map(rp => rp.permission.permissionKey) || [];
    
    // Apply user-level permission overrides
    const userGrants = user.userPermissions
      .filter(up => up.effect === 'ALLOW')
      .map(up => up.permission.permissionKey);
    
    const userDenies = user.userPermissions
      .filter(up => up.effect === 'DENY')
      .map(up => up.permission.permissionKey);

    // Final permissions = (role permissions + user grants) - user denies
    const permissions = [...new Set([...rolePermissions, ...userGrants])]
      .filter(p => !userDenies.includes(p));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId || undefined,
      roleKey: user.role?.key,
      sessionId: payload.sessionId,
      permissions,
    };
  }
}
