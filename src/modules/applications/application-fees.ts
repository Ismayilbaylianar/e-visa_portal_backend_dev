/**
 * The single rule for what an application costs.
 *
 * Pricing is PER APPLICANT (owner's decision, 2026-08-22). Every person
 * on a booking receives their own visa PDF, their own application code
 * and their own decision, so every person pays. Before this, all three
 * backend call sites summed the fee row and never multiplied, so a
 * family of five paid the same as one traveller — while the payment
 * page multiplied by head count and the sidebar summary multiplied the
 * government and service fees but not the expedited one. Three
 * different answers to the same question; this function is now the
 * only one.
 *
 * The expedited fee multiplies too. It buys faster processing of a
 * visa, and each applicant gets their own visa — charging it once for a
 * group would mean the other travellers are expedited for free, which
 * contradicts per-applicant pricing.
 */

export interface FeeRow {
  governmentFeeAmount: unknown;
  serviceFeeAmount: unknown;
  expeditedFeeAmount?: unknown;
  expeditedEnabled?: boolean;
}

export interface FeeTotals {
  /** Per-person amounts, exactly as configured on the fee row. */
  governmentFeePerApplicant: number;
  serviceFeePerApplicant: number;
  expeditedFeePerApplicant: number;
  /** Head count actually charged (never below 1 — see below). */
  applicantCount: number;
  /** Per-person amounts × head count. These are what get charged. */
  governmentFeeTotal: number;
  serviceFeeTotal: number;
  expeditedFeeTotal: number;
  totalAmount: number;
}

/**
 * @param applicantCount Number of non-deleted applicants. Floored at 1:
 *   an application is created before its first applicant exists, and a
 *   quote of 0.00 at that moment would be wrong in the customer's
 *   favour and confusing. The total is recomputed as applicants are
 *   added or removed, and the authoritative charge is taken at payment
 *   creation when the real count is known.
 */
export function computeFeeTotals(
  fee: FeeRow,
  applicantCount: number,
  expedited: boolean,
): FeeTotals {
  const count = Math.max(1, Math.floor(applicantCount || 0));

  const governmentFeePerApplicant = Number(fee.governmentFeeAmount) || 0;
  const serviceFeePerApplicant = Number(fee.serviceFeeAmount) || 0;
  const expeditedFeePerApplicant =
    expedited && fee.expeditedEnabled ? Number(fee.expeditedFeeAmount || 0) || 0 : 0;

  const governmentFeeTotal = round2(governmentFeePerApplicant * count);
  const serviceFeeTotal = round2(serviceFeePerApplicant * count);
  const expeditedFeeTotal = round2(expeditedFeePerApplicant * count);

  return {
    governmentFeePerApplicant,
    serviceFeePerApplicant,
    expeditedFeePerApplicant,
    applicantCount: count,
    governmentFeeTotal,
    serviceFeeTotal,
    expeditedFeeTotal,
    totalAmount: round2(governmentFeeTotal + serviceFeeTotal + expeditedFeeTotal),
  };
}

/** Money, so keep two decimals and avoid float dust like 169.99999999. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
