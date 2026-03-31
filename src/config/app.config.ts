import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // JWT Configuration (for future use)
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // Portal JWT Configuration (for future use)
  portalJwt: {
    accessSecret: process.env.PORTAL_JWT_ACCESS_SECRET || 'default-portal-access-secret',
    refreshSecret: process.env.PORTAL_JWT_REFRESH_SECRET || 'default-portal-refresh-secret',
    accessExpiration: process.env.PORTAL_JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.PORTAL_JWT_REFRESH_EXPIRATION || '7d',
  },

  // OTP Configuration
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },

  // Rate limiting (for future use)
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',
}));
