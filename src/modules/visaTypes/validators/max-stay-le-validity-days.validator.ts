import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Cross-field validator: maxStay must be <= validityDays.
 *
 * Used by both CreateVisaTypeDto (both fields required) and
 * UpdateVisaTypeDto (both optional). For partial updates the validator
 * skips when either field is undefined — the service-level guard then
 * re-checks against the persisted row's effective values.
 */
@ValidatorConstraint({ name: 'maxStayLeValidityDays', async: false })
export class MaxStayLeValidityDaysConstraint implements ValidatorConstraintInterface {
  validate(maxStay: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { validityDays?: number };
    if (typeof maxStay !== 'number' || typeof obj.validityDays !== 'number') {
      // Type checks (IsInt) on each field will surface their own errors;
      // skip cross-field comparison until both fields are well-formed.
      return true;
    }
    return maxStay <= obj.validityDays;
  }

  defaultMessage(): string {
    return 'maxStay must be less than or equal to validityDays';
  }
}

export function MaxStayLessThanOrEqualValidityDays(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxStayLeValidityDays',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: MaxStayLeValidityDaysConstraint,
    });
  };
}
