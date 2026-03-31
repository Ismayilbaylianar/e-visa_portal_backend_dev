import { PartialType } from '@nestjs/swagger';
import { CreateBindingNationalityFeeDto } from './create-binding-nationality-fee.dto';

export class UpdateBindingNationalityFeeDto extends PartialType(CreateBindingNationalityFeeDto) {}
