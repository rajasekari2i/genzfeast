import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * PATCH semantics (coding_standard.md §6): every field optional, only
 * submitted fields change. Matches contracts/openapi.yaml's
 * CompanyUpdateRequest, including the is_open and is_sms (FR-002a) and
 * operating_hours (specs/015-contact-us-page FR-005) fields.
 */
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contact_person?: string;

  // specs/015-contact-us-page research.md §8 — closes a pre-existing gap:
  // no format validation existed on this field before FR-007 required it.
  @IsOptional()
  @Matches(/^\d{10}$/, { message: 'mobile must be a 10-digit mobile number' })
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  is_open?: boolean;

  @IsOptional()
  @IsBoolean()
  is_sms?: boolean;

  // specs/015-contact-us-page FR-005 — optional free text; System Admin only.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  operating_hours?: string;
}
