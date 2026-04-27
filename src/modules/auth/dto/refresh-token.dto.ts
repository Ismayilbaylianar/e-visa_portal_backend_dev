import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { UserInfoDto } from './login.dto';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ description: 'New JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'New JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds', example: 3600 })
  expiresInSeconds: number;

  @ApiProperty({
    description:
      'Authenticated user info refreshed with current permissions. Frontend stores rely on this to keep permission-gated UI in sync after token refresh.',
    type: UserInfoDto,
  })
  user: UserInfoDto;
}
