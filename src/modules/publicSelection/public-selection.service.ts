import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeoLookupService } from '../geoLookup/geo-lookup.service';
import { NotFoundException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
  CascadeDestinationsResponseDto,
  CascadeVisaTypesResponseDto,
  DetectNationalityResponseDto,
} from './dto';

@Injectable()
export class PublicSelectionService {
  private readonly logger = new Logger(PublicSelectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoLookupService: GeoLookupService,
  ) {}

  /**
   * Get selection options for public UI
   *
   * Note: Nationality countries currently use the same countries table as destination countries.
   * This is an assumption - in production, you may want a separate nationality source or
   * filter countries that have at least one nationality fee configured.
   */
  async getOptions(): Promise<SelectionOptionsResponseDto> {
    const [destinationCountries, nationalityCountries, visaTypes] = await Promise.all([
      // Destination countries: have a published, active CountryPage. The page
      // join also gives us the URL slug (countries themselves no longer carry
      // a slug after the Module 1.5 split).
      this.prisma.country.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          page: {
            is: {
              isActive: true,
              isPublished: true,
              deletedAt: null,
            },
          },
        },
        include: {
          page: {
            select: { slug: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      // Nationality countries: any active reference country. Sprint 4 / UX-001
      // will refine this to "countries that appear as a nationality in at
      // least one active BindingNationalityFee".
      this.prisma.country.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      }),
      // Visa types: active only
      this.prisma.visaType.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
    ]);

    return {
      destinationCountries: destinationCountries.map((country: any) => ({
        id: country.id,
        name: country.name,
        slug: country.page?.slug,
        isoCode: country.isoCode,
        flagEmoji: country.flagEmoji,
      })),
      nationalityCountries: nationalityCountries.map((country) => ({
        id: country.id,
        name: country.name,
        // Nationality entries don't need a slug — left undefined.
        isoCode: country.isoCode,
        flagEmoji: country.flagEmoji,
      })),
      visaTypes: visaTypes.map((visaType) => ({
        id: visaType.id,
        purpose: visaType.purpose,
        validityDays: visaType.validityDays,
        maxStay: visaType.maxStay,
        entries: visaType.entries,
        label: visaType.label,
      })),
    };
  }

  /**
   * Get fee preview for a specific nationality + destination + visa type combination
   *
   * Matching logic:
   * 1. Find binding that matches destinationCountryId + visaTypeId
   * 2. Binding must be: active, not soft-deleted, valid by date range
   * 3. Find nationality fee that matches nationalityCountryId
   * 4. Fee must be: active, not soft-deleted
   *
   * Date validity:
   * - If validFrom is set, current date must be >= validFrom
   * - If validTo is set, current date must be <= validTo
   * - If both are null, binding is always valid
   */
  async getPreview(dto: SelectionPreviewRequestDto): Promise<SelectionPreviewResponseDto> {
    // M10 §C — same-country block (server-side authority).
    // The cascade UI removes the user's nationality from the destination
    // list, but a determined user could still POST a same-country combo
    // directly. Reject it here so the rule holds regardless of caller.
    if (dto.nationalityCountryId === dto.destinationCountryId) {
      throw new BadRequestException('Cannot apply for visa to own country', [
        {
          reason: ErrorCodes.SAME_COUNTRY_BLOCKED,
          message: 'You cannot apply for a visa to your own nationality.',
        },
      ]);
    }

    const now = new Date();

    // Find active binding with date validity check
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        isActive: true,
        deletedAt: null,
        // Date validity: validFrom <= now (or null)
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      },
      include: {
        template: {
          select: { id: true },
        },
        nationalityFees: {
          where: {
            nationalityCountryId: dto.nationalityCountryId,
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    // Check if binding exists
    if (!templateBinding) {
      throw new NotFoundException('No supported binding found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This destination and visa type combination is not currently available',
        },
      ]);
    }

    // Check date validity: validTo >= now (or null)
    if (templateBinding.validTo && templateBinding.validTo < now) {
      throw new NotFoundException('Binding has expired', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This destination and visa type combination is no longer available',
        },
      ]);
    }

    // Check if nationality fee exists
    const nationalityFee = templateBinding.nationalityFees[0];
    if (!nationalityFee) {
      throw new NotFoundException('No fee configured for nationality', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This visa type is not available for your nationality',
        },
      ]);
    }

    // Calculate fees. M11.2 — base fees stay per-nationality (the
    // government + service split varies by nationality), but
    // expedited config now reads from the binding itself. The per-fee
    // expedited columns remain populated for backwards compat but are
    // no longer the source of truth on the public preview.
    const governmentFeeAmount = Number(nationalityFee.governmentFeeAmount);
    const serviceFeeAmount = Number(nationalityFee.serviceFeeAmount);
    const expeditedEnabled = templateBinding.expeditedEnabled;
    const expeditedFeeAmount =
      expeditedEnabled && templateBinding.expeditedFeeAmount
        ? Number(templateBinding.expeditedFeeAmount)
        : null;
    const totalAmount = governmentFeeAmount + serviceFeeAmount;

    this.logger.log(
      `Preview generated for nationality: ${dto.nationalityCountryId}, destination: ${dto.destinationCountryId}, visa: ${dto.visaTypeId}`,
    );

    return {
      isEligible: true,
      bindingId: templateBinding.id,
      templateId: templateBinding.templateId,
      fees: {
        governmentFeeAmount: governmentFeeAmount.toFixed(2),
        serviceFeeAmount: serviceFeeAmount.toFixed(2),
        expeditedFeeAmount: expeditedFeeAmount !== null ? expeditedFeeAmount.toFixed(2) : null,
        currencyCode: nationalityFee.currencyCode,
        totalAmount: totalAmount.toFixed(2),
        expeditedEnabled,
      },
      // M11.3 — surface per-binding context the dynamic-form renderer
      // needs for cross-field date validation (`$bindingMinArrivalDays`)
      // and the native picker `min` attribute on the arrival date input.
      binding: {
        minArrivalDaysAdvance: templateBinding.minArrivalDaysAdvance ?? 3,
      },
    };
  }

  /**
   * M10 §A — Cascade step 1: list destinations available for a given
   * nationality.
   *
   * A destination is "available" when it has at least one active,
   * date-valid TemplateBinding that carries an active
   * BindingNationalityFee for the requested nationality. We filter at
   * the data layer so the dropdown never shows a country the user
   * would later get a "Visa not available" error on.
   *
   * The user's own nationality is excluded server-side (§C).
   */
  async getDestinationsForNationality(
    nationalityId: string,
  ): Promise<CascadeDestinationsResponseDto> {
    const now = new Date();

    // Find every active fee for this nationality, then walk back to
    // its binding to confirm the binding is itself active + date-valid.
    // We pull the destination country in the same query so we can map
    // straight to the response shape without a second round-trip.
    const fees = await this.prisma.bindingNationalityFee.findMany({
      where: {
        nationalityCountryId: nationalityId,
        isActive: true,
        deletedAt: null,
        templateBinding: {
          isActive: true,
          deletedAt: null,
          // validFrom <= now (or null) AND validTo >= now (or null)
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
          // Exclude same-country combos at the data layer.
          destinationCountryId: { not: nationalityId },
          destinationCountry: {
            isActive: true,
            deletedAt: null,
            page: {
              is: {
                isActive: true,
                isPublished: true,
                deletedAt: null,
              },
            },
          },
        },
      },
      select: {
        templateBinding: {
          select: {
            destinationCountry: {
              select: {
                id: true,
                name: true,
                isoCode: true,
                flagEmoji: true,
                page: { select: { slug: true } },
              },
            },
          },
        },
      },
    });

    // De-duplicate destinations (one country can appear via multiple
    // visa types) and sort alphabetically for stable UI ordering.
    const seen = new Map<string, CascadeDestinationsResponseDto['destinations'][number]>();
    for (const fee of fees) {
      const dest = fee.templateBinding?.destinationCountry;
      if (!dest || seen.has(dest.id)) continue;
      seen.set(dest.id, {
        id: dest.id,
        name: dest.name,
        isoCode: dest.isoCode,
        flagEmoji: dest.flagEmoji ?? undefined,
        slug: dest.page?.slug,
      });
    }

    const destinations = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));

    return { destinations };
  }

  /**
   * M10 §A — Cascade step 2: list visa types available for a given
   * (nationality, destination) pair.
   *
   * Same eligibility rules as `getDestinationsForNationality`, but
   * scoped to one destination. Same-country combos return an empty
   * list rather than throwing — the cascade UI never reaches step 2
   * for a same-country pair, but a direct caller will simply see
   * "no visa types available" which is consistent with the policy.
   */
  async getVisaTypesForCombination(
    nationalityId: string,
    destinationId: string,
  ): Promise<CascadeVisaTypesResponseDto> {
    if (nationalityId === destinationId) {
      return { visaTypes: [] };
    }

    const now = new Date();

    const fees = await this.prisma.bindingNationalityFee.findMany({
      where: {
        nationalityCountryId: nationalityId,
        isActive: true,
        deletedAt: null,
        templateBinding: {
          destinationCountryId: destinationId,
          isActive: true,
          deletedAt: null,
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
          visaType: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
      select: {
        templateBinding: {
          select: {
            visaType: {
              select: {
                id: true,
                label: true,
                purpose: true,
                validityDays: true,
                maxStay: true,
                entries: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });

    // De-duplicate by visaType.id (defensive — there's a uniqueness
    // constraint on (destinationCountryId, visaTypeId), so this should
    // be a no-op, but the cost is trivial and protects against future
    // schema changes.
    const seen = new Map<
      string,
      NonNullable<NonNullable<(typeof fees)[number]['templateBinding']>['visaType']>
    >();
    for (const fee of fees) {
      const vt = fee.templateBinding?.visaType;
      if (!vt || seen.has(vt.id)) continue;
      seen.set(vt.id, vt);
    }

    const visaTypes = Array.from(seen.values())
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.label.localeCompare(b.label);
      })
      .map((vt) => ({
        id: vt.id,
        label: vt.label,
        purpose: vt.purpose,
        validityDays: vt.validityDays,
        maxStay: vt.maxStay,
        entries: vt.entries,
      }));

    return { visaTypes };
  }

  /**
   * M10 §B — IP-based nationality auto-detect.
   *
   * Calls the GeoLookup stub (currently always returns null; will be
   * wired to MaxMind/ip-api in M10b). Three outcomes:
   *   1. Lookup returns null  → countryCode null + fallback message
   *   2. Lookup returns ISO code, no matching active country → same as 1
   *   3. Lookup returns ISO code, matched against active country → full
   *      country reference so frontend can pre-select the dropdown.
   */
  async detectNationalityByIp(ip: string): Promise<DetectNationalityResponseDto> {
    const fallback = 'Please select your nationality';

    if (!ip) {
      return { countryCode: null, fallback };
    }

    const geo = await this.geoLookupService.lookupByIp(ip);
    if (!geo?.countryCode) {
      this.logger.debug(`IP nationality detect: no resolution for ${ip}`);
      return { countryCode: null, fallback };
    }

    // Match against our active reference list. If the resolved country
    // isn't one we serve as a nationality, surface countryCode for
    // diagnostics but leave `country` undefined so the frontend falls
    // through to the manual dropdown.
    // M10 hotfix — also pull `page.slug` so the frontend can deep-link
    // to the destination's marketing page when the same country is
    // both nationality + destination (e.g. AZ user looking at AZ page).
    const country = await this.prisma.country.findFirst({
      where: {
        isoCode: geo.countryCode.toUpperCase(),
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        isoCode: true,
        flagEmoji: true,
        page: { select: { slug: true } },
      },
    });

    if (!country) {
      this.logger.debug(
        `IP nationality detect: ${ip} resolved to ${geo.countryCode} but not in active list`,
      );
      return { countryCode: geo.countryCode, fallback };
    }

    this.logger.log(`IP nationality detect: ${ip} → ${country.isoCode}`);
    return {
      countryCode: country.isoCode,
      country: {
        id: country.id,
        name: country.name,
        isoCode: country.isoCode,
        flagEmoji: country.flagEmoji ?? undefined,
        slug: country.page?.slug,
      },
    };
  }
}
