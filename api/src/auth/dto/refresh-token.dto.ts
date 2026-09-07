import { IsString, MinLength } from 'class-validator';

/** Shared by POST /auth/refresh and POST /auth/logout — both identify a session by its own raw refresh token. */
export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refresh_token!: string;
}
