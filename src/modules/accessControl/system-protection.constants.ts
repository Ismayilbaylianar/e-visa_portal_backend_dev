/**
 * Module 6 — System protection.
 *
 * Single source of truth for which roles / permission operations are
 * locked down at the service layer:
 *
 *   1. SYSTEM_ROLE_KEYS — roles seeded as `isSystem=true` in
 *      prisma/seed.ts. The DB schema marks them with `isSystem`, but
 *      we duplicate the key list here so the protection logic stays
 *      readable at the service layer (don't have to fetch + check
 *      isSystem before deciding a 409 path).
 *
 *   2. SUPER_ADMIN_ROLE_KEY — the single role whose user accounts
 *      have implicit god-mode. Self-modify and DELETE on those users
 *      is blocked unconditionally.
 *
 * Why hard-coded vs DB-driven: these keys are referenced by the seed
 * (`prisma/seed.ts`) and must stay in sync with the literal strings
 * the seeder writes. Fetching them at runtime would let an admin DELETE
 * the row and then bypass the protection on the next save — the file-
 * level constant prevents that race.
 */

export const SUPER_ADMIN_ROLE_KEY = 'superAdmin';

export const SYSTEM_ROLE_KEYS = [
  'superAdmin',
  'admin',
  'operator',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export function isSystemRole(roleKey: string | null | undefined): boolean {
  if (!roleKey) return false;
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(roleKey);
}

export function isSuperAdminRole(roleKey: string | null | undefined): boolean {
  return roleKey === SUPER_ADMIN_ROLE_KEY;
}
