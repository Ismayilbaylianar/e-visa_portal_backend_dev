import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateApplicationDto {
  @ApiPropertyOptional({
    description: 'Whether expedited processing is requested',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  expedited?: boolean;
}
