import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PortalIdentityUser } from '../types';

/**
 * Extracts the current portal identity from the request
 */
export const CurrentPortalIdentity = createParamDecorator(
  (data: keyof PortalIdentityUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const portalIdentity = request.portalIdentity as PortalIdentityUser;

    if (!portalIdentity) {
      return null;
    }

    return data ? portalIdentity[data] : portalIdentity;
  },
);
