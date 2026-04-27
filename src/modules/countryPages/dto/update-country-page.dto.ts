import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCountryPageDto } from './create-country-page.dto';

/**
 * Update payload. countryId is immutable once a page is created — to move
 * content to a different country you delete and recreate (intentional, since
 * the FK identity tightly couples sections + SEO to the country reference).
 */
export class UpdateCountryPageDto extends PartialType(
  OmitType(CreateCountryPageDto, ['countryId'] as const),
) {}
