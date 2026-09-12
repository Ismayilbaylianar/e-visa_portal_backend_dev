import type { Prisma } from '@prisma/client';

/**
 * The single definition of "this destination is sellable".
 *
 * A destination is sellable when it has at least one binding that is
 * active, not soft-deleted and inside its validity window, whose visa
 * type is active and not soft-deleted, carrying at least one active,
 * non-deleted nationality fee.
 *
 * This predicate was written out by hand in four places (the public
 * destinations list, the backfill script, the eligible-section checker
 * and the sellability probe). Four copies of a five-clause rule is four
 * chances to drift — and drift here is invisible: a destination quietly
 * appears in one surface and not another. It lives here once now.
 *
 * `now` is a parameter rather than a `new Date()` inside, so a single
 * request evaluates every surface against one instant.
 */
export function activeBindingWhere(now: Date): Prisma.TemplateBindingWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validTo: null }, { validTo: { gte: now } }] },
    ],
    visaType: { isActive: true, deletedAt: null },
  };
}

/**
 * The same rule expressed as a filter on a Country, for use as
 * `where: { ...sellableDestinationWhere(now) }` when selecting
 * destination countries.
 */
export function sellableDestinationWhere(now: Date): Prisma.CountryWhereInput {
  return {
    templateBindingsDestination: {
      some: {
        ...activeBindingWhere(now),
        nationalityFees: { some: { isActive: true, deletedAt: null } },
      },
    },
  };
}

/**
 * The same rule expressed as a filter on `binding_nationality_fees`,
 * scoped to one destination. This is what the eligible-nationality
 * lookup selects over.
 */
export function eligibleFeeWhere(
  destinationCountryId: string,
  now: Date,
): Prisma.BindingNationalityFeeWhereInput {
  return {
    isActive: true,
    deletedAt: null,
    templateBinding: {
      destinationCountryId,
      ...activeBindingWhere(now),
    },
  };
}
