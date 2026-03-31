import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roleId?: string;
  roleKey?: string;
  permissions?: string[];
}

export interface PortalIdentityUser {
  id: string;
  email: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
  requestId: string;
}

export interface RequestWithPortalIdentity extends Request {
  portalIdentity: PortalIdentityUser;
  requestId: string;
}

export interface RequestWithRequestId extends Request {
  requestId: string;
}
