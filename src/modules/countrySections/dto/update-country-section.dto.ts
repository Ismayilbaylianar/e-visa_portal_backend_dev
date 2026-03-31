import { PartialType } from '@nestjs/swagger';
import { CreateCountrySectionDto } from './create-country-section.dto';

export class UpdateCountrySectionDto extends PartialType(CreateCountrySectionDto) {}
