import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Rate Limit Profiles
 *
 * Different profiles for different endpoint sensitivity levels.
 * All values are configurable via environment variables.
 */
export const RateLimitProfiles = {
  OTP_SEND: { limit: 5, ttl: 60000 },
  OTP_VERIFY: { limit: 10, ttl: 60000 },
  AUTH_LOGIN: { limit: 10, ttl: 60000 },
  AUTH_REFRESH: { limit: 30, ttl: 60000 },
  STANDARD: { limit: 100, ttl: 60000 },
  RELAXED: { limit: 300, ttl: 60000 },
  STRICT: { limit: 3, ttl: 60000 },
} as const;

/**
 * Apply strict rate limiting for OTP send endpoint
 * 5 requests per minute per IP
 */
export function RateLimitOtpSend() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.OTP_SEND }),
    SetMetadata('rateLimitProfile', 'OTP_SEND'),
  );
}

/**
 * Apply rate limiting for OTP verification endpoint
 * 10 requests per minute per IP
 */
export function RateLimitOtpVerify() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.OTP_VERIFY }),
    SetMetadata('rateLimitProfile', 'OTP_VERIFY'),
  );
}

/**
 * Apply rate limiting for login endpoints
 * 10 requests per minute per IP
 */
export function RateLimitAuthLogin() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.AUTH_LOGIN }),
    SetMetadata('rateLimitProfile', 'AUTH_LOGIN'),
  );
}

/**
 * Apply rate limiting for token refresh endpoints
 * 30 requests per minute per IP
 */
export function RateLimitAuthRefresh() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.AUTH_REFRESH }),
    SetMetadata('rateLimitProfile', 'AUTH_REFRESH'),
  );
}

/**
 * Apply standard rate limiting
 * 100 requests per minute per IP
 */
export function RateLimitStandard() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.STANDARD }),
    SetMetadata('rateLimitProfile', 'STANDARD'),
  );
}

/**
 * Apply strict rate limiting for very sensitive endpoints
 * 3 requests per minute per IP
 */
export function RateLimitStrict() {
  return applyDecorators(
    Throttle({ default: RateLimitProfiles.STRICT }),
    SetMetadata('rateLimitProfile', 'STRICT'),
  );
}

/**
 * Skip rate limiting for this endpoint
 */
export function NoRateLimit() {
  return applyDecorators(SkipThrottle());
}
