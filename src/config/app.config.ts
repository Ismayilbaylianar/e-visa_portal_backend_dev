import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // JWT Configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpirationSeconds: parseInt(process.env.JWT_ACCESS_EXPIRATION_SECONDS || '3600', 10), // 1 hour
    refreshExpirationSeconds: parseInt(process.env.JWT_REFRESH_EXPIRATION_SECONDS || '604800', 10), // 7 days
  },

  // Portal JWT Configuration (for future use)
  portalJwt: {
    accessSecret: process.env.PORTAL_JWT_ACCESS_SECRET || 'dev-portal-access-secret',
    refreshSecret: process.env.PORTAL_JWT_REFRESH_SECRET || 'dev-portal-refresh-secret',
    accessExpirationSeconds: parseInt(
      process.env.PORTAL_JWT_ACCESS_EXPIRATION_SECONDS || '900',
      10,
    ), // 15 minutes
    refreshExpirationSeconds: parseInt(
      process.env.PORTAL_JWT_REFRESH_EXPIRATION_SECONDS || '604800',
      10,
    ), // 7 days
  },

  // OTP Configuration
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },

  // Bcrypt Configuration
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  // Rate limiting (for future use)
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'auto',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM_EMAIL || '',
      fromName: process.env.SMTP_FROM_NAME || 'Visa Portal',
    },
  },

  // M11.5 — Telegram notifications.
  // - `botToken` is sensitive and supplied via .env at runtime
  //   (Anar adds it on the prod box after this module deploys).
  // - The two chat IDs ARE the real production routing identifiers
  //   for the private Alerts + Activity channels; safe to commit.
  // - `enabled` is the master kill-switch — when false, every event
  //   still records a `status='skipped'` row so the admin /notifications
  //   feed continues working (Telegram is just suppressed).
  // - `adminBaseUrl` is the public-facing admin URL we link to in
  //   notifications. Kept here so the Telegram service can construct
  //   "open in admin" deep-links.
  telegram: {
    enabled: (process.env.TELEGRAM_ENABLED ?? 'false').toLowerCase() === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    alertsChatId:   process.env.TELEGRAM_ALERTS_CHAT_ID   || '-1003745374795',
    activityChatId: process.env.TELEGRAM_ACTIVITY_CHAT_ID || '-1003907564535',
    adminBaseUrl:   process.env.ADMIN_BASE_URL || 'https://evisaglobal.com',
  },
}));
