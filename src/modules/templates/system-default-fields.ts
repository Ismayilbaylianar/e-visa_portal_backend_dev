/**
 * M11.3 — system default fields auto-provisioned on every blank new
 * template. Boilerplates and clones skip this list (boilerplates have
 * their own curated fields from M11.2; clones inherit the source's
 * fields verbatim).
 *
 * Each field is locked to:
 *   - fieldType
 *   - validationRulesJson
 *   - isRequired (cannot flip false)
 *   - options (where applicable)
 *   - systemKey (cross-field-validator reference token)
 *
 * Admins CAN edit:
 *   - label / placeholder / helpText / sortOrder
 *   - visibilityRulesJson (use to hide via conditions instead of
 *     deleting)
 *
 * Date keyword tokens used here are resolved by the renderer's
 * `resolveDateKeyword` helper (frontend) and validator. The token
 * `$bindingMinArrivalDays` is M11.3-new and resolves to
 * `today + binding.minArrivalDaysAdvance` at validation time. The
 * `$systemKey` style references resolve to the value of another
 * field with that systemKey in the form payload.
 */

export interface SystemFieldSpec {
  /** Section title — fields with the same `(sectionOrder, sectionTitle)` are grouped. */
  sectionTitle: string;
  sectionDescription?: string;
  sectionOrder: number;
  field: {
    /** Stable cross-field reference token. Survives label rename. */
    systemKey: string;
    label: string;
    /** Lowercase to match the existing renderer enum (text/date/email/...). */
    fieldType: 'text' | 'textarea' | 'date' | 'email' | 'phone' | 'select' | 'radio' | 'checkbox' | 'country';
    placeholder?: string;
    helpText?: string;
    isRequired: boolean;
    /**
     * Validation rules. The renderer reads `min`/`max` (date keywords),
     * `minLength`/`maxLength`, `pattern`, and the `errorMessages`
     * shape we add here so each rule has a friendly message.
     */
    validationRulesJson: Record<string, unknown>;
    sortOrder: number;
  };
}

export const SYSTEM_DEFAULT_FIELDS: SystemFieldSpec[] = [
  // ─── Section 1: Personal Information ───
  {
    sectionTitle: 'Personal Information',
    sectionDescription: 'Please provide your personal details',
    sectionOrder: 1,
    field: {
      systemKey: 'firstName',
      label: 'First Name',
      fieldType: 'text',
      placeholder: 'Enter your first name',
      isRequired: true,
      validationRulesJson: {
        minLength: 2,
        maxLength: 50,
        errorMessages: {
          required: 'First name is required',
          minLength: 'First name must be at least 2 characters',
          maxLength: 'First name must be 50 characters or fewer',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'lastName',
      label: 'Last Name',
      fieldType: 'text',
      placeholder: 'Enter your last name',
      isRequired: true,
      validationRulesJson: {
        minLength: 2,
        maxLength: 50,
        errorMessages: {
          required: 'Last name is required',
          minLength: 'Last name must be at least 2 characters',
          maxLength: 'Last name must be 50 characters or fewer',
        },
      },
      sortOrder: 2,
    },
  },
  {
    sectionTitle: 'Personal Information',
    sectionOrder: 1,
    field: {
      systemKey: 'dateOfBirth',
      label: 'Date of Birth',
      fieldType: 'date',
      isRequired: true,
      helpText: 'You must be at least 18 years old',
      validationRulesJson: {
        max: 'today-18years',
        errorMessages: {
          required: 'Date of birth is required',
          max: 'You must be at least 18 years old',
        },
      },
      sortOrder: 3,
    },
  },

  // ─── Section 2: Passport Information ───
  {
    sectionTitle: 'Passport Information',
    sectionDescription: 'Enter your passport details',
    sectionOrder: 2,
    field: {
      systemKey: 'passportNumber',
      label: 'Passport Number',
      fieldType: 'text',
      placeholder: 'Enter passport number',
      isRequired: true,
      validationRulesJson: {
        pattern: '^[A-Z0-9]{6,15}$',
        errorMessages: {
          required: 'Passport number is required',
          pattern: 'Passport number must be 6–15 uppercase letters or digits',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Passport Information',
    sectionOrder: 2,
    field: {
      systemKey: 'passportIssueDate',
      label: 'Issue Date',
      fieldType: 'date',
      isRequired: true,
      validationRulesJson: {
        max: 'today',
        errorMessages: {
          required: 'Issue date is required',
          max: 'Issue date cannot be in the future',
        },
      },
      sortOrder: 2,
    },
  },
  {
    sectionTitle: 'Passport Information',
    sectionOrder: 2,
    field: {
      systemKey: 'passportExpiryDate',
      label: 'Expiry Date',
      fieldType: 'date',
      isRequired: true,
      helpText: 'Must be valid for at least 6 months from travel date',
      validationRulesJson: {
        min: 'today+6months',
        errorMessages: {
          required: 'Expiry date is required',
          min: 'Passport must be valid for at least 6 months from today',
        },
      },
      sortOrder: 3,
    },
  },

  // ─── Section 3: Travel Details (cross-field) ───
  {
    sectionTitle: 'Travel Details',
    sectionDescription: 'Tell us about your trip',
    sectionOrder: 3,
    field: {
      systemKey: 'plannedArrivalDate',
      label: 'Planned Arrival Date',
      fieldType: 'date',
      isRequired: true,
      helpText: 'Earliest date you can arrive at destination',
      validationRulesJson: {
        // `$bindingMinArrivalDays` resolves at validation time to
        // `today + binding.minArrivalDaysAdvance`. `$passportExpiryDate`
        // pulls from the form payload by systemKey.
        min: '$bindingMinArrivalDays',
        max: '$passportExpiryDate',
        errorMessages: {
          required: 'Arrival date is required',
          min: 'Arrival date must be at least {bindingMinArrivalDays} days from today',
          max: 'Arrival date cannot be after your passport expires',
        },
      },
      sortOrder: 1,
    },
  },
  {
    sectionTitle: 'Travel Details',
    sectionOrder: 3,
    field: {
      systemKey: 'plannedDepartureDate',
      label: 'Planned Departure Date',
      fieldType: 'date',
      isRequired: true,
      validationRulesJson: {
        min: '$plannedArrivalDate+1day',
        max: '$passportExpiryDate',
        errorMessages: {
          required: 'Departure date is required',
          min: 'Departure date must be after arrival date',
          max: 'Departure date cannot be after your passport expires',
        },
      },
      sortOrder: 2,
    },
  },
];

export const SYSTEM_FIELD_KEYS: string[] = SYSTEM_DEFAULT_FIELDS.map(
  (s) => s.field.systemKey,
);
