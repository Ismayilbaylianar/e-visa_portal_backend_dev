import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_COUNTRY_SECTIONS } from './default-sections';

/**
 * Auto-provision a country page the moment a destination becomes
 * sellable.
 *
 * Why: a destination could be fully bookable through /apply and still
 * be invisible on /countries because nobody had created its page, and
 * nothing told the admin. Argentina was in exactly that state — priced,
 * purchasable, and absent from the shop window.
 *
 * The page is created PUBLISHED with the same four starter sections an
 * admin-created page gets, so a configured destination appears without
 * a second manual step. That is the owner's stated intent. It is also
 * the safe direction here: the sections carry generic, accurate copy
 * (Requirements / Processing Time / Eligibility / How to Apply) rather
 * than placeholders, and the alternative — silently creating drafts —
 * reproduces the invisible-destination problem this is meant to end.
 *
 * Everything about the page stays editable afterwards through the
 * normal admin Country Pages screens: nothing here sets a lock flag,
 * and the rows are indistinguishable from hand-made ones apart from
 * their audit entry.
 */
@Injectable()
export class CountryPageAutocreateService {
  private readonly logger = new Logger(CountryPageAutocreateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure a destination has a country page.
   *
   * Idempotent and deliberately conservative:
   *   • a live page (draft OR published) → left completely alone, so an
   *     admin who deliberately unpublished a page does not have it
   *     silently re-published under them, and existing content is never
   *     overwritten;
   *   • a SOFT-DELETED page → also left alone, and reported. Reviving it
   *     would resurrect content the admin chose to remove; creating a
   *     second one would break the one-page-per-country rule and
   *     collide on the slug. This case needs a human, so we log it.
   *
   * Never throws into the caller: provisioning a marketing page must not
   * be able to fail an admin's binding/fee save.
   *
   * @returns what happened, so the backfill can report per destination.
   */
  async ensurePageForDestination(
    countryId: string,
  ): Promise<'created' | 'exists' | 'soft-deleted-skipped' | 'failed' | 'no-country'> {
    try {
      const country = await this.prisma.country.findFirst({
        where: { id: countryId, deletedAt: null },
        select: { id: true, name: true, isoCode: true },
      });
      if (!country) return 'no-country';

      const existing = await this.prisma.countryPage.findFirst({
        where: { countryId },
        select: { id: true, deletedAt: true, isPublished: true },
      });
      if (existing && !existing.deletedAt) return 'exists';
      if (existing?.deletedAt) {
        this.logger.warn(
          `Country page for ${country.name} (${country.isoCode}) is soft-deleted; not auto-recreating. Restore it in admin if the destination should be listed.`,
        );
        return 'soft-deleted-skipped';
      }

      const slug = await this.uniqueSlug(country.name, country.isoCode);

      await this.prisma.$transaction(async (tx) => {
        const created = await tx.countryPage.create({
          data: {
            countryId,
            slug,
            isActive: true,
            // Published on creation — see the class docblock.
            isPublished: true,
          },
        });
        await tx.countrySection.createMany({
          data: DEFAULT_COUNTRY_SECTIONS.map((seed) => ({
            countryPageId: created.id,
            slot: seed.slot,
            title: seed.title,
            content: seed.content,
            sortOrder: seed.sortOrder,
            isActive: true,
          })),
        });
      });

      this.logger.log(
        `Auto-created published country page for ${country.name} (${country.isoCode}) at /${slug}`,
      );
      return 'created';
    } catch (err) {
      // Swallow: this is a convenience behaviour hanging off a catalog
      // write. The admin's actual save has already succeeded and must
      // not be rolled back because a marketing page could not be made.
      this.logger.error(
        `Auto-create country page failed for country ${countryId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return 'failed';
    }
  }

  /**
   * Slugs are globally unique across country pages, including
   * soft-deleted ones (the column has a plain unique index), so a
   * previously-deleted "argentina" would block reuse. Fall back to the
   * ISO code, then to a numeric suffix.
   */
  private async uniqueSlug(name: string, isoCode: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || isoCode.toLowerCase();

    const candidates = [base, `${base}-${isoCode.toLowerCase()}`];
    for (const candidate of candidates) {
      const taken = await this.prisma.countryPage.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    for (let n = 2; n < 50; n++) {
      const candidate = `${base}-${n}`;
      const taken = await this.prisma.countryPage.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
