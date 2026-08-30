/**
 * Read-only check for the "Eligible Countries" section on every live
 * country page.
 *
 * The section is admin-authored HTML, not a generated list, so the risk
 * is not a query cap or pagination cut-off — it is drift: fees get added
 * or removed and the hand-written list stops matching. This prints, per
 * destination, how many nationalities actually have an active fee versus
 * how many list items the section contains.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/verify-eligible-sections.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

async function main() {
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = ctx.get(PrismaService);
  const now = new Date();

  const pages = await prisma.countryPage.findMany({
    where: { deletedAt: null, isActive: true, isPublished: true },
    select: {
      slug: true,
      country: { select: { id: true, name: true } },
      sections: {
        where: { deletedAt: null, isActive: true },
        select: { title: true, content: true },
      },
    },
    orderBy: { slug: 'asc' },
  });

  for (const page of pages) {
    const fees = await prisma.bindingNationalityFee.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        templateBinding: {
          destinationCountryId: page.country.id,
          isActive: true,
          deletedAt: null,
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
          visaType: { isActive: true, deletedAt: null },
        },
      },
      select: { nationalityCountryId: true },
      // No take/skip: every matching row, so a cap cannot hide anything.
    });
    const eligible = new Set(fees.map((f) => f.nationalityCountryId)).size;

    const section = page.sections.find((s) => /eligib/i.test(s.title ?? ''));
    if (!section) {
      console.log(
        `${page.country.name.padEnd(14)} fees=${String(eligible).padEnd(4)} — no "Eligible" section on the page`,
      );
      continue;
    }
    const listed = (section.content ?? '').match(/<li[\s>]/gi)?.length ?? 0;
    const flag = listed === eligible ? 'MATCH' : `DRIFT (${listed} listed vs ${eligible} sellable)`;
    console.log(
      `${page.country.name.padEnd(14)} fees=${String(eligible).padEnd(4)} listed=${String(listed).padEnd(4)} ${flag}`,
    );
  }

  await ctx.close();
}

main().catch((e) => {
  console.error('Verify failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
