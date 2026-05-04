import { Injectable, Logger } from '@nestjs/common';
import { GeoLookupResponseDto } from './dto';

/**
 * One cache entry. Stores when it was inserted so we can compute TTL
 * lazily, plus a sentinel for the negative-cache case (lookup ran,
 * resolved to nothing) — we still want to remember that for an hour
 * to avoid hammering ip-api.com on the same unknown IP.
 */
interface CacheEntry {
  /** Resolved result, or null if the lookup ran but produced nothing. */
  result: GeoLookupResponseDto | null;
  insertedAt: number;
}

/**
 * Real IP→country resolver backed by ip-api.com (free tier, no key,
 * 45 req/min per IP — well within our budget for landing-page hits).
 *
 * Behavior:
 *   - 2-second hard timeout via AbortController; any failure returns
 *     null so the caller falls through to the manual dropdown.
 *   - In-memory cache by IP, 1-hour TTL, cap 1000 entries (LRU-ish:
 *     when full, drop the oldest 200 by insertedAt).
 *   - Private/loopback ranges short-circuit to null without hitting
 *     the network — reduces test-from-server noise + protects against
 *     accidentally leaking internal addresses to ip-api.
 *
 * Future M10b: swap for MaxMind GeoLite2 (offline DB) for higher
 * throughput. The interface stays the same so callers don't change.
 */
@Injectable()
export class GeoLookupService {
  private readonly logger = new Logger(GeoLookupService.name);

  private static readonly TIMEOUT_MS = 2000;
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly CACHE_MAX_ENTRIES = 1000;
  private static readonly CACHE_EVICT_BATCH = 200;
  private static readonly API_URL = 'http://ip-api.com/json';

  /**
   * Mutable cache. Keyed by raw IP string. Single-process only — fine
   * for the demo box; if we ever scale horizontally we'd push this
   * into Redis with the same key/value shape.
   */
  private readonly cache = new Map<string, CacheEntry>();

  async lookupByIp(ipAddress: string): Promise<GeoLookupResponseDto | null> {
    if (!ipAddress) {
      return null;
    }
    const ip = this.normalizeIp(ipAddress);

    // Private / loopback / link-local — never round-trip to ip-api.
    if (this.isPrivateAddress(ip)) {
      this.logger.debug(`Geo lookup skipped for private IP: ${ip}`);
      return null;
    }

    // Cache hit (positive or negative — both block another network call).
    const cached = this.readCache(ip);
    if (cached !== undefined) {
      this.logger.debug(`Geo lookup cache hit for ${ip}`);
      return cached;
    }

    let result: GeoLookupResponseDto | null = null;
    try {
      result = await this.fetchFromApi(ip);
    } catch (err) {
      // Any failure (network, timeout, parse error, rate limit) is
      // treated as "unknown". Logged at debug, NOT warn, since a
      // failed lookup is recoverable and we don't want to fill the
      // log with noise during normal hits on flaky connections.
      this.logger.debug(`Geo lookup failed for ${ip}: ${this.formatError(err)}`);
      result = null;
    }

    this.writeCache(ip, result);
    return result;
  }

  // =========================================================
  // Private — network
  // =========================================================

  private async fetchFromApi(ip: string): Promise<GeoLookupResponseDto | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GeoLookupService.TIMEOUT_MS);
    try {
      // `fields=status,countryCode,country` keeps the response tiny and
      // avoids the implicit-cost columns ip-api charges for. `status`
      // is "success" or "fail" — anything else we treat as miss.
      const url = `${GeoLookupService.API_URL}/${encodeURIComponent(ip)}?fields=status,countryCode,country,message`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        status?: string;
        countryCode?: string;
        country?: string;
        message?: string;
      };
      if (data.status !== 'success' || !data.countryCode) {
        return null;
      }
      return {
        countryCode: data.countryCode.toUpperCase(),
        countryName: data.country ?? data.countryCode,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // =========================================================
  // Private — IP classification
  // =========================================================

  /**
   * Strip IPv4-mapped IPv6 prefix (e.g. `::ffff:1.2.3.4` → `1.2.3.4`).
   * Express's `req.ip` regularly yields the prefixed form behind
   * IPv4 reverse proxies.
   */
  private normalizeIp(ip: string): string {
    const trimmed = ip.trim();
    if (trimmed.toLowerCase().startsWith('::ffff:')) {
      return trimmed.substring(7);
    }
    return trimmed;
  }

  /**
   * RFC 1918 + loopback + link-local + IPv6 unique-local. Conservative
   * so we never accidentally call ip-api with an internal address.
   */
  private isPrivateAddress(ip: string): boolean {
    if (!ip) return true;
    // IPv6 loopback / link-local / ULA
    if (ip === '::1') return true;
    if (ip.toLowerCase().startsWith('fe80:')) return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;

    // IPv4 — split + numeric check; cheaper than regex for the hot path.
    const parts = ip.split('.');
    if (parts.length !== 4) {
      // Not a parseable IPv4. Could be an IPv6 global address — let it
      // through to ip-api which handles both.
      return false;
    }
    const octets = parts.map((p) => Number(p));
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      // Bad shape. Treat as private to avoid sending garbage to ip-api.
      return true;
    }
    const [a, b] = octets;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }

  // =========================================================
  // Private — cache
  // =========================================================

  /**
   * Returns the cached value if the entry is still fresh, the
   * negative-cache sentinel (`null`) if a previous lookup resolved
   * to nothing, or `undefined` to signal "no cache entry, do a fetch".
   */
  private readCache(ip: string): GeoLookupResponseDto | null | undefined {
    const entry = this.cache.get(ip);
    if (!entry) return undefined;
    if (Date.now() - entry.insertedAt > GeoLookupService.CACHE_TTL_MS) {
      this.cache.delete(ip);
      return undefined;
    }
    return entry.result;
  }

  private writeCache(ip: string, result: GeoLookupResponseDto | null): void {
    if (this.cache.size >= GeoLookupService.CACHE_MAX_ENTRIES) {
      this.evictOldest();
    }
    this.cache.set(ip, { result, insertedAt: Date.now() });
  }

  /**
   * Drop the `CACHE_EVICT_BATCH` oldest entries. Cheaper than an LRU
   * data structure for our scale and gives us roughly the same
   * "trim oldest first" behavior. Map iteration order is insertion
   * order in V8, which is what we want.
   */
  private evictOldest(): void {
    let toEvict = GeoLookupService.CACHE_EVICT_BATCH;
    for (const key of this.cache.keys()) {
      if (toEvict-- <= 0) break;
      this.cache.delete(key);
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      if (err.name === 'AbortError') return `timeout after ${GeoLookupService.TIMEOUT_MS}ms`;
      return err.message;
    }
    return String(err);
  }
}
