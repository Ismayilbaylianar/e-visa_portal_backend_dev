import { PartialType } from '@nestjs/swagger';
import { CreateVisaTypeDto } from './create-visa-type.dto';

export class UpdateVisaTypeDto extends PartialType(CreateVisaTypeDto) {}
