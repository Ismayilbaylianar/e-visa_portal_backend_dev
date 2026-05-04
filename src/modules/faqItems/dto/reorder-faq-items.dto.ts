import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class FaqReorderItem {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'New per-category sort key' })
  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class ReorderFaqItemsDto {
  @ApiProperty({ type: [FaqReorderItem] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FaqReorderItem)
  items: FaqReorderItem[];
}
