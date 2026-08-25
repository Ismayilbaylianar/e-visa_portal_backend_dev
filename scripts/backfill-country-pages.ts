/**
 * One-off backfill: give every already-sellable destination a country
 * page, so nothing stays purchasable-but-invisible.
 *
 * A destination qualifies when it has an active, date-valid, non-deleted
 * binding with an active visa type and at least one active, non-deleted
 * nationality fee — the same rule /countries filters on.
 *
 * Safe to re-run: `ensurePageForDestination` never touches an existing
 * page (published, draft, or soft-deleted) and never overwrites content.
 *
 *   npx ts-node scripts/backfill-country-pages.ts          # report only
 *   npx ts-node scripts/backfill-country-pages.ts --apply  # create pages
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CountryPageAutocreateService } from '../src/modules/countryPages/country-page-autocreate.service';

async function main() {
  const apply = process.argv.includes('--apply');
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = ctx.get(PrismaService);
  const autocreate = ctx.get(CountryPageAutocreateService);
  const now = new Date();

  const sellable = await prisma.country.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      templateBindingsDestination: {
        some: {
          isActive: true,
          deletedAt: null,
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
          visaType: { isActive: true, deletedAt: null },
          nationalityFees: { some: { isActive: true, deletedAt: null } },
        },
      },
    },
    select: { id: true, name: true, isoCode: true, page: { select: { id: true, deletedAt: true, isPublished: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(`Sellable destinations: ${sellable.length}`);
  const missing = sellable.filter((c) => !c.page || c.page.deletedAt);
  console.log(`Already have a live page: ${sellable.length - missing.length}`);
  console.log(`Need a page: ${missing.length}`);
  for (const c of missing) {
    console.log(`   - ${c.name} (${c.isoCode})${c.page?.deletedAt ? '  [soft-deleted page exists]' : ''}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to create the pages above.');
    await ctx.close();
    return;
  }

  console.log('\nApplying…');
  const tally: Record<string, number> = {};
  for (const c of missing) {
    const result = await autocreate.ensurePageForDestination(c.id);
    tally[result] = (tally[result] ?? 0) + 1;
    console.log(`   ${c.name} (${c.isoCode}) -> ${result}`);
  }
  console.log('\nResult:', JSON.stringify(tally));
  await ctx.close();
}

main().catch((e) => {
  console.error('Backfill failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
