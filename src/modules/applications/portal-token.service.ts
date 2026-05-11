import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * M11.13 (BUG U + T) — Stateless signed token for direct customer
 * deep-links to /portal/[code]?token=...
 *
 * Why stateless: every status-change email needs a unique
 * per-recipient deep-link, and a real database row per token would
 * be wasteful for a 24-hour redirect. The token IS the credential;
 * server-side verification uses the same HMAC pattern as the file
 * storage signed URLs (BUG C). Secret reuse is safe because the
 * payload + audience format ("p-" prefix on payloads) is different
 * — file URLs and portal tokens can never be confused.
 *
 * Token format: `<base64url(payload)>.<base64url(sig)>`
 *   payload = JSON{ a: applicationId, e: email, i: intent, exp: epochSec, t: 'p' }
 *   sig = HMAC-SHA256(payload, FILES_SIGNING_SECRET || JWT_SECRET)
 */
@Injectable()
export class PortalTokenService {
  private readonly logger = new Logger(PortalTokenService.name);
  private readonly DEFAULT_TTL_SEC = 24 * 60 * 60; // 24 hours

  constructor(private readonly configService: ConfigService) {}

  private getSecret(): string {
    const s =
      this.configService.get<string>('FILES_SIGNING_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      '';
    if (!s) {
      this.logger.error(
        '[BUG U+T] No FILES_SIGNING_SECRET / JWT_SECRET configured — portal tokens will fail verification.',
      );
    }
    return s;
  }

  /**
   * Mint a token good for the given intent + applicationId + email.
   * Intents: 'status' | 'upload' | 'download'. Frontend uses the
   * intent to default the right tab open on /portal/[code].
   */
  mint(args: {
    applicationId: string;
    email: string;
    intent: 'status' | 'upload' | 'download';
    ttlSec?: number;
  }): string {
    const ttl = args.ttlSec ?? this.DEFAULT_TTL_SEC;
    const payload = {
      a: args.applicationId,
      e: args.email.toLowerCase().trim(),
      i: args.intent,
      exp: Math.floor(Date.now() / 1000) + ttl,
      t: 'p',
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.getSecret())
      .update(payloadB64)
      .digest('base64url');
    return `${payloadB64}.${sig}`;
  }

  /**
   * Verify a token. Returns the decoded payload on success, throws
   * on any failure (bad shape, bad sig, expired, wrong audience).
   */
  verify(token: string): {
    applicationId: string;
    email: string;
    intent: 'status' | 'upload' | 'download';
  } {
    const [payloadB64, sig] = (token || '').split('.');
    if (!payloadB64 || !sig) throw new Error('Malformed token');
    const expectedSig = crypto
      .createHmac('sha256', this.getSecret())
      .update(payloadB64)
      .digest('base64url');
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      throw new Error('Invalid signature');
    }
    let payload: { a: string; e: string; i: string; exp: number; t: string };
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch {
      throw new Error('Malformed payload');
    }
    if (payload.t !== 'p') {
      // Audience guard — prevents a file-serve signed token (which
      // also uses HMAC over JSON with this same secret) from being
      // accepted here. Portal tokens always have t:'p'.
      throw new Error('Wrong token audience');
    }
    if (
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new Error('Token expired');
    }
    if (!payload.a || !payload.e || !payload.i) {
      throw new Error('Missing token fields');
    }
    if (!['status', 'upload', 'download'].includes(payload.i)) {
      throw new Error('Invalid intent');
    }
    return {
      applicationId: payload.a,
      email: payload.e,
      intent: payload.i as 'status' | 'upload' | 'download',
    };
  }
}
