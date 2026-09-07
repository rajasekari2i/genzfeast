import { IsString, MinLength } from 'class-validator';

/** Matches contracts/openapi.yaml's DeviceRegistrationRequest. */
export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  fcm_token!: string;

  /** The caller's own current-session refresh token — links this registration to a specific session (research.md §1). */
  @IsString()
  @MinLength(1)
  refresh_token!: string;
}
