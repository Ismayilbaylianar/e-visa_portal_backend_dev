import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  email: string;
  fullName: string;
  roleId?: string;
  roleKey?: string;
  sessionId: string;
  permissions: string[];
}

/**
 * Extracts the current authenticated user from the request
 * @param data - Optional property name to extract from user object
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
