/**
 * Server-side completeness check for an application's applicant forms.
 *
 * Why this exists: required-field validation used to live only in the
 * browser. An applicant carrying nothing but `firstName` could be
 * pushed through /review over the API, took a reference code, reached
 * UNPAID and was payable — leaving the operator a blank case they
 * could not process (found on prod, 2026-08-22).
 *
 * The rules are NOT restated here. They are read from the template the
 * application is bound to (`template_fields.isRequired`,
 * `validationRulesJson`, `visibilityRulesJson`), which is the same
 * definition the form renderer hands the client — so the two cannot
 * drift, and an admin editing a template changes both at once.
 */

/** Shape of `template_fields.visibilityRulesJson`. Mirrors the client's
 *  `isFieldVisible` in components/forms/dynamic/visibility.ts. */
interface VisibilityRule {
  when?: { field?: string; equals?: unknown };
  mode?: 'show' | 'hide';
}

export interface CompletenessField {
  fieldKey: string;
  label?: string | null;
  fieldType?: string | null;
  isRequired: boolean;
  isActive: boolean;
  validationRulesJson?: unknown;
  visibilityRulesJson?: unknown;
}

export interface CompletenessApplicant {
  id: string;
  applicationCode?: string | null;
  isMainApplicant: boolean;
  formDataJson: unknown;
}

export interface CompletenessError {
  field: string;
  reason: string;
  message: string;
}

/**
 * A field only counts as required if it is actually on screen for this
 * applicant's answers. Identical semantics to the client so a form that
 * passes in the browser passes here: no rule (or no `when.field`) means
 * always visible; `mode: 'hide'` inverts the match; comparison is by
 * string so "1" and 1 agree.
 */
function isFieldVisible(raw: unknown, values: Record<string, unknown>): boolean {
  if (!raw) return true;
  // The column is sometimes an array of rules and sometimes a single
  // object; older rows store an empty array meaning "no condition".
  const rules: VisibilityRule[] = Array.isArray(raw)
    ? (raw as VisibilityRule[])
    : [raw as VisibilityRule];
  for (const rule of rules) {
    if (!rule || !rule.when || !rule.when.field) continue;
    const actual = values[rule.when.field];
    const matches = String(actual ?? '') === String(rule.when.equals ?? '');
    const visible = rule.mode === 'hide' ? !matches : matches;
    if (!visible) return false;
  }
  return true;
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Human handle for an applicant in an error message. */
function describe(applicant: CompletenessApplicant, index: number): string {
  const fd = (applicant.formDataJson ?? {}) as Record<string, unknown>;
  const name = [fd.firstName, fd.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (applicant.applicationCode) return applicant.applicationCode;
  return applicant.isMainApplicant ? 'Main applicant' : `Applicant ${index + 1}`;
}

/**
 * Validate every applicant's `formDataJson` against the template's
 * active fields. Returns one entry per problem, addressed so the UI can
 * point at the exact applicant and field.
 *
 * File fields are skipped: uploads live in the `documents` table, not
 * in `formDataJson`, so a missing value here says nothing about whether
 * the document was provided.
 */
export function collectCompletenessErrors(
  fields: CompletenessField[],
  applicants: CompletenessApplicant[],
): CompletenessError[] {
  const errors: CompletenessError[] = [];
  const active = fields.filter((f) => f.isActive && f.isRequired);

  applicants.forEach((applicant, index) => {
    const values = (applicant.formDataJson ?? {}) as Record<string, unknown>;
    const who = describe(applicant, index);

    for (const field of active) {
      if (field.fieldType === 'file') continue;
      if (!isFieldVisible(field.visibilityRulesJson, values)) continue;
      if (!isBlank(values[field.fieldKey])) continue;

      // Prefer the template author's own wording when they supplied one.
      const rules = (field.validationRulesJson ?? {}) as {
        errorMessages?: { required?: string };
      };
      const detail = rules?.errorMessages?.required || `${field.label || field.fieldKey} is required`;

      errors.push({
        field: `applicants[${index}].${field.fieldKey}`,
        reason: 'validationFailed',
        message: `${who}: ${detail}`,
      });
    }
  });

  return errors;
}
